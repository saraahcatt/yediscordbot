# Ye Discord Bot — apresentação

Site de apresentação da Ye, com cenas 3D que acompanham o scroll, funcionalidades do bot e convite de instalação no Discord.

## Tecnologia

HTML, CSS, JavaScript e Three.js 0.170.0, servido localmente no projeto. As cenas usam geometria procedural; o avatar é fornecido pelo responsável pelo projeto. Sem instalação de dependências, contas próprias ou banco de visitantes.

## Publicação

O repositório é preparado para GitHub Pages. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**. O workflow publica somente `public/` ao atualizar a branch `main`; também pode ser iniciado manualmente.

O endereço de um site de projeto é `https://SEU-USUARIO.github.io/yediscordbot/`. O nome de usuário é definido pela conta proprietária no GitHub. O endereço não é um domínio `.com.br`.

## Edição e conferência

Edite os arquivos em `public/` e execute `node scripts/security-check.mjs`. Para conferir localmente com Python: `python -m http.server 4173 --bind 127.0.0.1 --directory public`.

Os links e recursos usam caminhos relativos para funcionar no subdiretório `/yediscordbot/`. O botão de instalação abre diretamente o Discord, sem callback ou token recebido pelo site.

## Segurança da hospedagem

A CSP no HTML, o hash do import map, o bloqueio de scripts inline executáveis e o referrer `no-referrer` são mantidos. O GitHub Pages serve conteúdo estático: o Worker da hospedagem anterior e seus cabeçalhos personalizados não fazem parte desta versão. Cabeçalhos HTTP e HTTPS são controlados pelo provedor e devem ser conferidos depois da publicação; a CSP em meta não oferece `frame-ancestors`.

## Licenças

MIT para o código original do site, com o escopo descrito em `LICENSE`. A licença MIT original do Three.js está em `public/vendor/THREE-LICENSE.txt`. Avatar, imagens, marcas e código do bot Discord não estão incluídos na licença do site.

Contato do projeto: **9v50** no Discord.
