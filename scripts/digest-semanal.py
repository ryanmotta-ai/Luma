#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LUMA — Relatório semanal de novos materiais (roda toda segunda-feira).

REGRA DE NEGÓCIO (por que é assim):
  · NUNCA e-mail individual: um envio por grupo, todo mundo em BCC. Ninguém
    recebe "o material X foi publicado" — recebe o resumo da semana.
  · NUNCA um e-mail por material: os materiais da janela são agrupados por
    campanha dentro de UM único e-mail.
  · SEGMENTAÇÃO POR PAPEL: franqueado recebe SÓ a seção de artes. Seções
    internas (RH, quando existir) só saem para equipe_dm/gestao. Isso vive na
    tabela SECOES abaixo — adicionar RH é adicionar uma linha lá, sem tocar em
    mais nada.
  · Semana sem material novo = NENHUM e-mail. Relatório vazio é ruído.

Sem dependência externa: só a stdlib (urllib, smtplib, ssl, email).
Dados vêm do PostgREST do Supabase com a service_role (o script roda no
GitHub Actions, nunca no navegador — a service_role JAMAIS vai para o front).

Uso:
    python scripts/digest-semanal.py --dry-run      # não envia; gera os previews
    python scripts/digest-semanal.py --to eu@dm.com # envio de teste só pra mim
    python scripts/digest-semanal.py                # envio real (o que o cron faz)
    python scripts/digest-semanal.py --dias 14      # janela maior (1ª execução)

Variáveis (.env local ou secrets do Actions) — veja .env.example:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
    EMAIL_FROM (opcional, default = SMTP_USER)
    EMAIL_CC   (opcional, cópia visível — ex.: o próprio marketing)
    LUMA_URL   (opcional, link do app no e-mail)
"""

import argparse
import json
import os
import smtplib
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage

# ── Marca ────────────────────────────────────────────────────────────────────
# Cliente de e-mail não lê CSS var nem <style>: aqui o hex é obrigatório e os
# valores ESPELHAM os tokens de css/00-tokens.css. Mudou o token, mude aqui.
C_LARANJA = "#FF9000"   # --dm-orange
C_CTA     = "#F85400"   # --dm-orange-d (contraste AA com texto branco pequeno)
C_TEXTO   = "#0A0A0A"   # --text
C_TEXTO_2 = "#3A3A3A"   # --text-2
C_TEXTO_3 = "#6B6B6B"   # --text-3
C_LINHA   = "#F2F2F2"   # --gray-light
C_BRANCO  = "#FFFFFF"   # --white

APP_URL_PADRAO = "https://ryanmotta-ai.github.io/Luma/"
JANELA_PADRAO = 7
LOTE_BCC = 50   # ponytail: limite prático de destinatários por mensagem no SMTP comum

FMT_LABEL = {"story": "Story", "feed": "Feed", "post": "Post", "wide": "Post"}

# Seções do relatório. `roles` = quem PODE receber a seção.
# RH (futuro) entra como:
#   {"chave": "rh", "titulo": "Comunicados do RH", "roles": ("equipe_dm", "gestao")}
# — franqueado fica de fora por construção, não por um `if` espalhado.
SECOES = [
    {"chave": "artes", "titulo": "Novas artes no catálogo",
     "roles": ("franqueado", "equipe_dm", "gestao")},
]

# Grupos de envio: um e-mail por grupo (BCC), nunca por pessoa.
GRUPOS = [
    {"chave": "franqueado", "roles": ("franqueado",),
     "intro": "Estes materiais entraram no catálogo na última semana. "
              "Abra o Luma, escolha um e gere a arte da sua cidade."},
    {"chave": "equipe", "roles": ("equipe_dm", "gestao"),
     "intro": "Resumo do que a equipe publicou na última semana."},
]


# ── .env (parser manual, sem dependência) ────────────────────────────────────
def carregar_env(caminho=".env"):
    """KEY=VALUE por linha. setdefault: o ambiente (Actions) sempre manda mais
    que o arquivo local."""
    if not os.path.exists(caminho):
        return
    with open(caminho, "r", encoding="utf-8") as fh:
        for linha in fh:
            linha = linha.strip()
            if not linha or linha.startswith("#"):
                continue
            chave, sep, valor = linha.partition("=")
            if not sep:
                continue
            os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def exigir(*chaves):
    faltando = [c for c in chaves if not os.environ.get(c)]
    if faltando:
        raise ValueError(
            "Variáveis obrigatórias ausentes: " + ", ".join(faltando) + " — veja .env.example"
        )


# ── Supabase (PostgREST) ─────────────────────────────────────────────────────
def _api(tabela, params, schema=None):
    """GET no PostgREST. `schema='luma'` porque o domínio do Luma não vive em public."""
    base = os.environ["SUPABASE_URL"].rstrip("/")
    chave = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{base}/rest/v1/{tabela}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "apikey": chave,
        "Authorization": f"Bearer {chave}",
        "Accept": "application/json",
        **({"Accept-Profile": schema} if schema else {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", "replace")[:400]
        raise RuntimeError(f"Supabase {tabela} respondeu {e.code}: {corpo}") from None


def buscar_campanhas_novas(dias):
    """Materiais publicados na janela, agrupados por campanha (pasta).

    Filtra o que o franqueado não veria mesmo: material vencido e campanha
    inativa. Anunciar o que não está no catálogo é pior que não anunciar.
    """
    corte = (datetime.now(timezone.utc) - timedelta(days=dias)).isoformat()
    hoje = date.today().isoformat()
    materiais = _api("templates", {
        "select": "nome,fmt,pasta_id,publicado_em,validade",
        "publicado": "eq.true",
        "publicado_em": f"gte.{corte}",
        "or": f"(validade.is.null,validade.gte.{hoje})",
        "order": "publicado_em.desc",
    }, schema="luma")
    if not materiais:
        return []

    pastas = {p["id"]: p for p in _api("pastas", {"select": "id,nome,ativa"}, schema="luma")}

    agrupado = {}
    for m in materiais:
        pasta = pastas.get(m.get("pasta_id"))
        if not pasta or not pasta.get("ativa"):
            continue                      # campanha desligada: o material não está no ar
        agrupado.setdefault(pasta["nome"], []).append(m)
    return sorted(agrupado.items(), key=lambda kv: (-len(kv[1]), kv[0]))


def buscar_destinatarios(roles):
    perfis = _api("profiles", {
        "select": "email,role",
        "ativo": "eq.true",
        "role": "in.(" + ",".join(roles) + ")",
    })
    # dedup preservando ordem; e-mail vazio no perfil derruba o envio inteiro no SMTP
    vistos, saida = set(), []
    for p in perfis:
        email = (p.get("email") or "").strip()
        if email and email.lower() not in vistos:
            vistos.add(email.lower())
            saida.append(email)
    return saida


# ── HTML ─────────────────────────────────────────────────────────────────────
def esc(txt):
    return (str(txt or "")
            .replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _formatos(materiais):
    labels = []
    for m in materiais:
        rot = FMT_LABEL.get((m.get("fmt") or "").lower(), (m.get("fmt") or "").title())
        if rot and rot not in labels:
            labels.append(rot)
    return " · ".join(labels)


def secao_artes_html(campanhas):
    linhas = []
    for nome_campanha, materiais in campanhas:
        itens = "".join(
            f'<div style="font:400 14px/1.5 Roboto,Arial,sans-serif;color:{C_TEXTO_2};'
            f'padding:2px 0;">• {esc(m["nome"])}</div>'
            for m in materiais
        )
        linhas.append(
            f'<tr><td style="padding:14px 0;border-bottom:1px solid {C_LINHA};">'
            f'<div style="font:700 15px/1.3 Roboto,Arial,sans-serif;color:{C_TEXTO};">'
            f'{esc(nome_campanha)}</div>'
            f'<div style="font:500 11px/1.4 Roboto,Arial,sans-serif;color:{C_TEXTO_3};'
            f'text-transform:uppercase;letter-spacing:.08em;padding:3px 0 8px;">'
            f'{len(materiais)} {"material" if len(materiais) == 1 else "materiais"}'
            f'{" &nbsp;·&nbsp; " + esc(_formatos(materiais)) if _formatos(materiais) else ""}</div>'
            f'{itens}</td></tr>'
        )
    return "".join(linhas)


def montar_html(grupo, campanhas, total, periodo):
    app_url = os.environ.get("LUMA_URL", APP_URL_PADRAO)
    corpo = []
    for secao in SECOES:
        if not all(r in secao["roles"] for r in grupo["roles"]):
            continue                       # é aqui que o franqueado não recebe o RH
        if secao["chave"] == "artes":
            corpo.append(
                f'<tr><td style="font:900 20px/1.2 Roboto,Arial,sans-serif;color:{C_TEXTO};'
                f'padding:26px 0 2px;">{esc(secao["titulo"])}</td></tr>'
                + secao_artes_html(campanhas)
            )
    return f"""<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:{C_LINHA};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="max-width:640px;margin:0 auto;background:{C_BRANCO};border-radius:10px;
              padding:32px;font-variant-numeric:tabular-nums;">
  <tr><td>
    <div style="font:900 22px/1 Roboto,Arial,sans-serif;color:{C_LARANJA};
                letter-spacing:-.02em;">LUMA</div>
    <div style="font:500 11px/1.4 Roboto,Arial,sans-serif;color:{C_TEXTO_3};
                text-transform:uppercase;letter-spacing:.08em;padding-top:6px;">
      Relatório da semana &nbsp;·&nbsp; {esc(periodo)}</div>
  </td></tr>
  <tr><td style="font:900 26px/1.2 Roboto,Arial,sans-serif;color:{C_TEXTO};padding:22px 0 8px;">
    {total} {"novo material" if total == 1 else "novos materiais"} nesta semana</td></tr>
  <tr><td style="font:400 15px/1.6 Roboto,Arial,sans-serif;color:{C_TEXTO_2};">
    {esc(grupo["intro"])}</td></tr>
  {"".join(corpo)}
  <tr><td style="padding:28px 0 8px;">
    <a href="{esc(app_url)}" style="display:inline-block;background:{C_CTA};color:{C_BRANCO};
       font:700 14px/1 Roboto,Arial,sans-serif;text-decoration:none;padding:14px 22px;
       border-radius:6px;">Abrir o Luma</a></td></tr>
  <tr><td style="font:400 12px/1.6 Roboto,Arial,sans-serif;color:{C_TEXTO_3};padding-top:18px;">
    Você recebe este resumo por fazer parte da rede Delivery Much.
    É um envio semanal automático — não responda este e-mail.</td></tr>
</table></body></html>"""


# ── Envio ────────────────────────────────────────────────────────────────────
def enviar(assunto, html, destinatarios):
    """Um envio por lote, todo mundo em BCC.

    Os destinatários NÃO entram em nenhum header: To fica com o remetente e a
    entrega real vai por to_addrs. É isso que garante "nunca individual" sem
    expor a lista de e-mails da rede inteira.
    """
    remetente = os.environ.get("EMAIL_FROM") or os.environ["SMTP_USER"]
    cc = [e.strip() for e in (os.environ.get("EMAIL_CC") or "").split(",") if e.strip()]
    contexto = ssl.create_default_context()

    with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", 587))) as srv:
        srv.starttls(context=contexto)
        srv.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
        for i in range(0, len(destinatarios), LOTE_BCC):
            lote = destinatarios[i:i + LOTE_BCC]
            msg = EmailMessage()
            msg["Subject"] = assunto
            msg["From"] = remetente
            msg["To"] = remetente          # a lista real vai em to_addrs (BCC)
            if cc:
                msg["Cc"] = ", ".join(cc)
            msg.set_content("Este e-mail contém HTML. Use um cliente compatível.")
            msg.add_alternative(html, subtype="html")
            srv.send_message(msg, to_addrs=lote + cc)
            print(f"      lote {i // LOTE_BCC + 1}: {len(lote)} destinatário(s)")


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description="Relatório semanal de novos materiais do Luma")
    ap.add_argument("--dry-run", action="store_true",
                    help="não envia; grava preview_email-<grupo>.html")
    ap.add_argument("--to", help="sobrescreve os destinatários (teste). Separe por vírgula")
    ap.add_argument("--dias", type=int, default=JANELA_PADRAO,
                    help=f"janela em dias (default {JANELA_PADRAO})")
    args = ap.parse_args()

    carregar_env()
    exigir("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    if not args.dry_run:
        exigir("SMTP_HOST", "SMTP_USER", "SMTP_PASS")

    campanhas = buscar_campanhas_novas(args.dias)
    total = sum(len(m) for _, m in campanhas)
    if not total:
        print(f"Nenhum material publicado nos últimos {args.dias} dias — nenhum e-mail enviado.")
        return 0

    inicio = (date.today() - timedelta(days=args.dias)).strftime("%d/%m")
    periodo = f"{inicio} a {date.today().strftime('%d/%m')}"
    assunto = os.environ.get("EMAIL_SUBJECT") or (
        f"Luma · {total} {'novo material' if total == 1 else 'novos materiais'} nesta semana"
    )
    print(f"{total} material(is) em {len(campanhas)} campanha(s) · {periodo}")

    override = [e.strip() for e in (args.to or "").split(",") if e.strip()]
    falhou = False

    for grupo in GRUPOS:
        html = montar_html(grupo, campanhas, total, periodo)
        if args.dry_run:
            arquivo = f"preview_email-{grupo['chave']}.html"
            with open(arquivo, "w", encoding="utf-8") as fh:
                fh.write(html)
            print(f"  [{grupo['chave']}] assunto: {assunto}")
            print(f"  [{grupo['chave']}] preview: {arquivo} · "
                  f"{len(override or buscar_destinatarios(grupo['roles']))} destinatário(s)")
            continue

        destinatarios = override or buscar_destinatarios(grupo["roles"])
        if not destinatarios:
            print(f"  [{grupo['chave']}] AVISO: nenhum destinatário ativo — pulado.")
            continue
        try:
            # best-effort por grupo: falha no envio da equipe não pode segurar o
            # dos franqueados (e vice-versa)
            print(f"  [{grupo['chave']}] enviando para {len(destinatarios)} destinatário(s)…")
            enviar(assunto, html, destinatarios)
            print(f"  [{grupo['chave']}] ok")
        except Exception as e:                              # noqa: BLE001
            falhou = True
            print(f"  [{grupo['chave']}] AVISO: falhou — {e}", file=sys.stderr)

    return 1 if falhou else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as erro:                               # noqa: BLE001
        print(f"ERRO: {erro}", file=sys.stderr)
        sys.exit(1)
