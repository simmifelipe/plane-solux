# Roteiro de deploy em produção (fork com controle de acesso por módulo e por issue)

Este roteiro leva esta versão do Plane (fork com restrição de acesso por módulo e por item de trabalho) para **uma máquina nova**, usando o `docker-compose.yml` da raiz do repositório. Esse compose **constrói as imagens a partir do código-fonte**, por isso a sua feature vai junto. O instalador oficial (`deployments/cli/community/install.sh`) baixa imagens prontas do upstream e **não** contém a feature, então não use ele.

> Convenção: troque `SEU_DOMINIO` (por exemplo `plane.suaempresa.com.br`) e `SEU_EMAIL` pelos seus valores. Comandos prefixados por `$` rodam na máquina nova.

---

## 0. Visão geral do que será criado

Todos os serviços sobem por Docker Compose, atrás de um único proxy (Caddy) que atende em `80`/`443`:

| Serviço                 | Função                                           | Exposto fora do Docker?          |
| ----------------------- | ------------------------------------------------ | -------------------------------- |
| `proxy`                 | Caddy: HTTPS automático e roteamento por caminho | **Sim** (80 e 443)               |
| `web`                   | Aplicativo principal (`/`)                       | Não                              |
| `admin`                 | Painel da instância (`/god-mode/`)               | Não                              |
| `space`                 | Páginas públicas (`/spaces/`)                    | Não                              |
| `live`                  | Edição colaborativa (`/live/`)                   | Não                              |
| `api`                   | Django/Gunicorn (`/api/`, `/auth/`, `/static/`)  | Não                              |
| `worker`, `beat-worker` | Tarefas em segundo plano (Celery)                | Não                              |
| `migrator`              | Aplica as migrations e termina                   | Não                              |
| `plane-db`              | PostgreSQL 15 (já com `jit=off`)                 | Não                              |
| `plane-redis`           | Cache (Valkey)                                   | Não                              |
| `plane-mq`              | RabbitMQ (fila do Celery)                        | Não                              |
| `plane-minio`           | Armazenamento de arquivos compatível com S3      | Não, só via proxy em `/uploads/` |

Volumes que guardam **todos os dados**: `pgdata`, `uploads`, `redisdata`, `rabbitmq_data`, `proxy_data` (certificados) e `proxy_config`.

Roteamento do proxy: `/` → web, `/god-mode/` → admin, `/spaces/` → space, `/live/` → live, `/api/`, `/auth/`, `/static/` → api, `/uploads/` → MinIO.

---

## 1. Pré-requisitos

### 1.1 Servidor

- Linux x86_64 ou ARM64 (instruções para Ubuntu 22.04/24.04 LTS).
- **Mínimo:** 2 vCPU, 4 GB de RAM, 40 GB de disco. **Recomendado:** 4 vCPU, 8 GB de RAM, 80 GB de disco SSD.
- O **primeiro build** das imagens consome muita memória (o front é compilado com Vite). Com menos de 8 GB, crie swap (passo 2.3) ou construa as imagens em outra máquina (seção 12.3).

### 1.2 Domínio e rede

- Um domínio ou subdomínio (`SEU_DOMINIO`) com registro **A** (e AAAA, se usar IPv6) apontando para o IP público da máquina. Confirme antes de seguir:
  ```
  $ dig +short SEU_DOMINIO
  ```
  O resultado precisa ser o IP da máquina, senão o Let's Encrypt não emite o certificado.
- Portas **80** e **443** liberadas no firewall do provedor (security group) e no firewall do servidor. **Nenhuma outra porta** deve ser aberta (PostgreSQL, RabbitMQ e MinIO ficam só na rede interna do Docker).

### 1.3 Acesso ao código

O código está no repositório **privado** `simmifelipe/plane-solux`, branch `main`. Como ele é privado, o servidor precisa de uma credencial de **somente leitura** para clonar e atualizar: uma _deploy key_ do GitHub (passo 3.1). Não use sua senha nem um token pessoal com acesso total.

---

## 2. Preparar a máquina (Ubuntu)

### 2.1 Atualizar o sistema e criar um usuário de operação

```
$ sudo apt-get update && sudo apt-get -y upgrade
$ sudo adduser --disabled-password --gecos "" plane
$ sudo usermod -aG sudo plane
```

Copie sua chave SSH para o usuário `plane` e passe a usar `ssh plane@SEU_DOMINIO`. Desative login por senha e login direto do `root` em `/etc/ssh/sshd_config` (`PasswordAuthentication no`, `PermitRootLogin no`) e rode `sudo systemctl restart ssh`.

### 2.2 Firewall do servidor

```
$ sudo ufw default deny incoming
$ sudo ufw default allow outgoing
$ sudo ufw allow OpenSSH
$ sudo ufw allow 80/tcp
$ sudo ufw allow 443/tcp
$ sudo ufw enable
$ sudo ufw status
```

> Atenção: o Docker publica portas direto no iptables e **ignora o ufw**. Isso não é problema aqui, porque só o `proxy` publica portas (80/443). Não adicione `ports:` a nenhum outro serviço.

### 2.3 Swap (recomendado se a máquina tem menos de 8 GB)

```
$ sudo fallocate -l 4G /swapfile
$ sudo chmod 600 /swapfile
$ sudo mkswap /swapfile && sudo swapon /swapfile
$ echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.4 Instalar Docker e Docker Compose

Siga o método oficial (repositório apt do Docker):

```
$ sudo apt-get install -y ca-certificates curl git
$ sudo install -m 0755 -d /etc/apt/keyrings
$ sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
$ sudo chmod a+r /etc/apt/keyrings/docker.asc
$ echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
$ sudo apt-get update
$ sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
$ sudo usermod -aG docker plane
```

Saia e entre de novo na sessão SSH e confirme:

```
$ docker --version
$ docker compose version
$ docker run --rm hello-world
```

### 2.5 Limitar o tamanho dos logs dos containers (evita encher o disco)

Crie `/etc/docker/daemon.json`:

```
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
```

e rode `sudo systemctl restart docker`.

---

## 3. Baixar o código

### 3.1 Criar uma deploy key (somente leitura) no servidor

```
$ ssh-keygen -t ed25519 -N "" -C "plane-deploy@SEU_DOMINIO" -f ~/.ssh/plane_deploy
$ cat ~/.ssh/plane_deploy.pub
```

Copie a linha que o `cat` mostrou e cadastre no GitHub: repositório `simmifelipe/plane-solux` → **Settings → Deploy keys → Add deploy key**. Dê um título (por exemplo, o nome do servidor) e **deixe desmarcado "Allow write access"**. Depois diga ao SSH qual chave usar, acrescentando este bloco ao arquivo `~/.ssh/config`:

```
Host github-plane
  HostName github.com
  User git
  IdentityFile ~/.ssh/plane_deploy
  IdentitiesOnly yes
```

```
$ chmod 600 ~/.ssh/config
$ ssh -T git@github-plane      # deve responder "Hi simmifelipe/plane-solux! ..."
```

### 3.2 Clonar

```
$ sudo mkdir -p /opt/plane && sudo chown plane:plane /opt/plane
$ git clone --branch main git@github-plane:simmifelipe/plane-solux.git /opt/plane
$ cd /opt/plane
$ git log --oneline -5
```

Confirme que o histórico mostra os commits da feature (`feat: per-module and per-issue access control` e os seguintes).

> **Dica:** fixe a versão que você implantou: `git rev-parse HEAD` e anote o hash. Ele é o seu ponto de retorno (seção 10.4).

---

## 4. Configurar as variáveis de ambiente

São **3 arquivos** a criar, todos ignorados pelo git:

| Arquivo                     | Usado por                                        |
| --------------------------- | ------------------------------------------------ |
| `/opt/plane/.env`           | `docker compose` (banco, RabbitMQ, MinIO, proxy) |
| `/opt/plane/apps/api/.env`  | `api`, `worker`, `beat-worker`, `migrator`       |
| `/opt/plane/apps/live/.env` | `live`                                           |

Os `.env` de `apps/web`, `apps/admin` e `apps/space` **não são usados em produção**: o front é compilado dentro da imagem e acessa a API pelo mesmo domínio, via proxy. Não é preciso criá-los.

> **Não use `${VAR}` dentro dos `.env`.** Escreva valores literais. Os arquivos de exemplo usam interpolação (por exemplo, o `DATABASE_URL`), mas isso é frágil. Os comandos abaixo já geram os valores finais.

### 4.1 Gerar os segredos e criar os três arquivos de uma vez

Copie, ajuste as duas primeiras linhas e cole no terminal, dentro de `/opt/plane`. O script gera senhas aleatórias (hexadecimais, sem caracteres que quebrem URLs) e grava os três arquivos.

```
$ cd /opt/plane
$ export DOMAIN="SEU_DOMINIO"
$ export ACME_EMAIL="SEU_EMAIL"

$ PG_PASS=$(openssl rand -hex 24)
$ MQ_PASS=$(openssl rand -hex 24)
$ S3_KEY=$(openssl rand -hex 10)
$ S3_SECRET=$(openssl rand -hex 24)
$ DJANGO_SECRET=$(openssl rand -hex 32)
$ LIVE_SECRET=$(openssl rand -hex 32)

$ cat > .env <<EOF
POSTGRES_USER="plane"
POSTGRES_PASSWORD="${PG_PASS}"
POSTGRES_DB="plane"
PGDATA="/var/lib/postgresql/data"

RABBITMQ_USER="plane"
RABBITMQ_PASSWORD="${MQ_PASS}"
RABBITMQ_VHOST="plane"

AWS_REGION=""
AWS_ACCESS_KEY_ID="${S3_KEY}"
AWS_SECRET_ACCESS_KEY="${S3_SECRET}"
AWS_S3_BUCKET_NAME="uploads"
FILE_SIZE_LIMIT=5242880

LISTEN_HTTP_PORT=80
LISTEN_HTTPS_PORT=443

SITE_ADDRESS=${DOMAIN}
CERT_EMAIL="email ${ACME_EMAIL}"
CERT_ACME_CA=https://acme-v02.api.letsencrypt.org/directory
CERT_ACME_DNS=
TRUSTED_PROXIES=0.0.0.0/0
EOF

$ cat > apps/api/.env <<EOF
DEBUG=0
SECRET_KEY="${DJANGO_SECRET}"
CORS_ALLOWED_ORIGINS="https://${DOMAIN}"

POSTGRES_USER="plane"
POSTGRES_PASSWORD="${PG_PASS}"
POSTGRES_HOST="plane-db"
POSTGRES_DB="plane"
POSTGRES_PORT=5432
DATABASE_URL="postgresql://plane:${PG_PASS}@plane-db:5432/plane"

REDIS_HOST="plane-redis"
REDIS_PORT="6379"
REDIS_URL="redis://plane-redis:6379/"

RABBITMQ_HOST="plane-mq"
RABBITMQ_PORT="5672"
RABBITMQ_USER="plane"
RABBITMQ_PASSWORD="${MQ_PASS}"
RABBITMQ_VHOST="plane"

USE_MINIO=1
AWS_REGION=""
AWS_ACCESS_KEY_ID="${S3_KEY}"
AWS_SECRET_ACCESS_KEY="${S3_SECRET}"
AWS_S3_ENDPOINT_URL="http://plane-minio:9000"
AWS_S3_BUCKET_NAME="uploads"
FILE_SIZE_LIMIT=5242880
SIGNED_URL_EXPIRATION=3600
MINIO_ENDPOINT_SSL=1

WEB_URL="https://${DOMAIN}"
APP_BASE_URL="https://${DOMAIN}"
APP_BASE_PATH=""
ADMIN_BASE_URL="https://${DOMAIN}"
ADMIN_BASE_PATH="/god-mode"
SPACE_BASE_URL="https://${DOMAIN}"
SPACE_BASE_PATH="/spaces"
LIVE_BASE_URL="https://${DOMAIN}"
LIVE_BASE_PATH="/live"
LIVE_SERVER_SECRET_KEY="${LIVE_SECRET}"

GUNICORN_WORKERS=3
HARD_DELETE_AFTER_DAYS=60
API_KEY_RATE_LIMIT="60/minute"
NUM_PROXIES=1
DEFAULT_USER_LANGUAGE="pt-BR"
EOF

$ cat > apps/live/.env <<EOF
PORT=3000
API_BASE_URL="http://api:8000"
WEB_BASE_URL="https://${DOMAIN}"
LIVE_BASE_URL="https://${DOMAIN}"
LIVE_BASE_PATH="/live"
LIVE_SERVER_SECRET_KEY="${LIVE_SECRET}"
CORS_ALLOWED_ORIGINS="https://${DOMAIN}"
REDIS_HOST="plane-redis"
REDIS_PORT=6379
REDIS_URL="redis://plane-redis:6379/"
EOF

$ chmod 600 .env apps/api/.env apps/live/.env
```

> Estes arquivos contêm todas as senhas. **Guarde uma cópia segura** (gerenciador de senhas ou cofre). Se você perder `SECRET_KEY`, sessões e tokens existentes deixam de valer; se perder as chaves do MinIO, os arquivos enviados ficam inacessíveis.

### 4.2 O que cada ponto crítico significa

- **`CERT_EMAIL="email SEU_EMAIL"`:** o valor inclui a palavra `email`, porque o Caddyfile injeta a variável como uma diretiva inteira. Se pôr só o endereço, o Caddy não inicia.
- **`SITE_ADDRESS=SEU_DOMINIO`:** com um nome de domínio, o Caddy emite o certificado Let's Encrypt sozinho. Para testar só em HTTP, use `:80` (e `MINIO_ENDPOINT_SSL=0` e URLs `http://`).
- **Os valores de `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `POSTGRES_*` e `RABBITMQ_*` precisam ser iguais** no `.env` da raiz e no `apps/api/.env`. O script já garante isso.
- **`LIVE_SERVER_SECRET_KEY` precisa ser igual** em `apps/api/.env` e `apps/live/.env`.
- **`NUM_PROXIES=1`:** o proxy do compose é um salto na frente da API (usado para ler o IP real nos limites de requisição). Some mais um se houver CDN ou balanceador na frente.
- **`DEFAULT_USER_LANGUAGE="pt-BR"`:** novos usuários nascem em português. Quem já tem conta mantém a escolha atual.
- **`MINIO_ENDPOINT_SSL=1`:** as URLs de upload geradas passam a ser `https`. Deixe `0` se estiver sem HTTPS.
- **`GUNICORN_WORKERS`:** use de 2 a 4 (aproximadamente 1 por vCPU, no máximo).

### 4.3 Checar se nada ficou em branco

```
$ grep -nE '=""?$' .env apps/api/.env apps/live/.env
```

Só `AWS_REGION`, `CERT_ACME_DNS` e `APP_BASE_PATH` podem aparecer vazios.

---

## 5. Construir e subir

### 5.1 Construir as imagens

```
$ cd /opt/plane
$ docker compose build
```

Demora de 15 a 40 minutos na primeira vez (compila web, admin, space, live, a API e o proxy). Os próximos builds reaproveitam cache. Se o processo for morto no meio (`Killed`), é falta de memória: crie swap (2.3) ou veja a seção 12.3.

### 5.2 Subir os serviços

```
$ docker compose up -d
```

O `migrator` roda sozinho, aplica as migrations (inclusive `0126` e `0127`, da feature e do idioma padrão) e termina. A `api` espera as migrations terminarem para iniciar.

### 5.3 Acompanhar a subida

```
$ docker compose ps
$ docker compose logs -f migrator      # deve terminar sem erro
$ docker compose logs -f api           # deve mostrar o gunicorn escutando em :8000
```

Estado esperado em `docker compose ps`:

- `plane-migrator`: `Exited (0)`
- todos os outros: `Up` (e `healthy` onde houver healthcheck)

---

## 6. Verificações imediatas

```
$ curl -sI https://SEU_DOMINIO/                     | head -3    # 200
$ curl -s  https://SEU_DOMINIO/api/instances/       | head -c 200   # JSON com "instance"
$ curl -sI https://SEU_DOMINIO/god-mode/            | head -3    # 200
$ curl -sI https://SEU_DOMINIO/live/health          | head -3    # 200
```

Confira o certificado (deve ser emitido pelo Let's Encrypt) e que a migration foi aplicada:

```
$ echo | openssl s_client -connect SEU_DOMINIO:443 -servername SEU_DOMINIO 2>/dev/null | openssl x509 -noout -issuer -dates
$ docker compose exec plane-db psql -U plane -d plane -c "select name from django_migrations where name like '012%' order by id desc limit 3;"
$ docker compose exec plane-db psql -U plane -d plane -c "show jit;"      # deve ser off
```

Esperado: `0127_profile_default_language`, `0126_resource_access_and_restricted_flags` e `jit = off`.

---

## 7. Primeiro acesso e configuração da instância

### 7.1 Criar o administrador da instância

Abra `https://SEU_DOMINIO/god-mode/`, preencha e-mail, senha e nome da instância. Essa conta é o **administrador da instância** (não precisa ser o mesmo usuário do workspace).

### 7.2 Configurar o e-mail (SMTP)

Em **Email**, informe host, porta, usuário, senha e remetente. Sem SMTP, convites por e-mail, redefinição de senha e notificações por e-mail **não funcionam**. Envie um e-mail de teste pelo próprio painel.

### 7.3 Criar o workspace e os projetos

Entre em `https://SEU_DOMINIO/`, faça login com a conta do admin e crie o workspace. Use um _slug_ simples (sem espaços e acentos). Nomes de projeto não aceitam hífen nem acentos: use, por exemplo, `Domus` com o identificador `DOMUS`.

### 7.4 Convidar usuários

Em **Configurações do workspace → Membros**, convide por e-mail (precisa do SMTP). Cada usuário escolhe a senha ao aceitar.

### 7.5 Idioma

Novos usuários já nascem em pt-BR por causa do `DEFAULT_USER_LANGUAGE`. Para usuários criados antes dessa variável existir:

```
$ docker compose exec plane-db psql -U plane -d plane -c "update profiles set language='pt-BR';"
```

Ou cada pessoa escolhe em **Configurações → Preferências → Idioma**.

### 7.6 Login com Google (opcional)

1. No Google Cloud Console, crie credenciais OAuth (aplicativo da Web).
2. Origem JavaScript autorizada: `https://SEU_DOMINIO`.
3. URI de redirecionamento autorizada: `https://SEU_DOMINIO/auth/google/callback/` (a barra final é obrigatória).
4. Em `https://SEU_DOMINIO/god-mode/` → **Authentication → Google**, cole Client ID e Client Secret e ative.

### 7.7 Controlar quem pode se cadastrar

Por padrão, qualquer pessoa que abra a página pode criar uma conta. Em uma instância interna, desative o cadastro aberto em `/god-mode/` → **Authentication**, e entre só por convite. Depois de criar o primeiro admin, faça isso antes de divulgar o endereço.

### 7.8 Telemetria

Em `/god-mode/` → **General**, desative a telemetria, se não quiser enviar dados de uso.

---

## 8. Validar a feature de acesso por módulo e por issue

Faça com três contas: **admin** (administrador do projeto), **Alice** e **Bob** (membros do projeto, sem permissões especiais). Num projeto com 2 módulos e 3 issues:

**Módulo**

1. Admin abre o módulo e clica no **cadeado** da barra lateral. Ativa **Restringir acesso**, adiciona a Alice com "Ver".
2. Alice: o módulo aparece, somente leitura. Bob: o módulo some da lista e o link direto dá 404.
3. Admin marca "Comentar" para a Alice: a caixa de comentário aparece nas issues do módulo.

**Issue**

1. Admin abre uma issue (painel lateral ou tela cheia) e clica no cadeado. Restringe e dá "Ver" + "Comentar" à Alice.
2. Alice: vê a issue, comenta, mas não edita. Bob: não vê a issue.
3. Sem "Comentar", Alice vê o aviso "Você não tem permissão para comentar…" em vez da caixa de texto.

**Regras para conferir**

- Admin do projeto sempre vê e edita tudo.
- Issue em vários módulos restritos aparece se o usuário tiver permissão em **qualquer** um.
- As permissões da issue restrita **substituem** as do módulo.
- Quem criou a issue e os responsáveis continuam vendo-a.
- Itens restritos não aparecem em busca, notificações, exportações, Intake nem ciclos para quem não tem acesso.

### 8.1 Rodar a suíte de testes (opcional, recomendado antes de liberar)

Em uma máquina de desenvolvimento (não precisa ser a de produção), com o `.env` de testes gerado por `./setup.sh`:

```
$ docker compose -f docker-compose-test.yml run --rm --build api-tests \
    pytest plane/tests/unit/utils/test_resource_access.py \
           plane/tests/contract/app/test_resource_access_app.py \
           plane/tests/contract/app/test_resource_access_management_app.py \
           plane/tests/contract/app/test_resource_access_edges_app.py \
           plane/tests/contract/api/test_resource_access_api.py \
           plane/tests/unit/models/test_profile_language.py
```

Esperado: todos passam (107 testes). O `docker-compose-test.yml` sobe RabbitMQ e Redis, então os testes que dependem de fila também funcionam.

---

## 9. Backup e restauração

Os dados que importam: o **banco** (`pgdata`) e os **arquivos enviados** (`uploads`). Faça backup dos dois, mais dos três `.env`.

### 9.1 Backup do banco (diário, automatizado)

Crie `/opt/plane/backup.sh`:

```
#!/usr/bin/env bash
set -euo pipefail
cd /opt/plane
DEST=/opt/plane-backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"
docker compose exec -T plane-db pg_dump -U plane -d plane -Fc > "$DEST/db-$STAMP.dump"
docker run --rm -v plane_uploads:/data -v "$DEST":/backup alpine \
  tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .
tar czf "$DEST/env-$STAMP.tar.gz" .env apps/api/.env apps/live/.env
find "$DEST" -type f -mtime +14 -delete
```

> O nome do volume depende do nome da pasta do projeto. Confira com `docker volume ls | grep uploads`. Com a pasta `/opt/plane`, ele é `plane_uploads`.

```
$ chmod +x /opt/plane/backup.sh
$ crontab -e
# todo dia às 03:00
0 3 * * * /opt/plane/backup.sh >> /var/log/plane-backup.log 2>&1
```

**Copie os arquivos de `/opt/plane-backups` para fora da máquina** (outro servidor, bucket S3, etc.). Backup na mesma máquina não protege contra perda do disco.

### 9.2 Restaurar o banco

```
$ cd /opt/plane
$ docker compose stop api worker beat-worker web admin space live
$ docker compose exec -T plane-db psql -U plane -d postgres -c "drop database plane;" -c "create database plane;"
$ docker compose exec -T plane-db pg_restore -U plane -d plane --no-owner < /opt/plane-backups/db-AAAAMMDD-HHMMSS.dump
$ docker compose up -d
```

### 9.3 Restaurar os arquivos

```
$ docker run --rm -v plane_uploads:/data -v /opt/plane-backups:/backup alpine \
    sh -c "cd /data && tar xzf /backup/uploads-AAAAMMDD-HHMMSS.tar.gz"
```

### 9.4 Testar a restauração

Um backup que nunca foi restaurado não é backup. Restaure em uma máquina de teste ao menos uma vez.

---

## 10. Atualizações e rollback

### 10.1 Aplicar mudanças do seu repositório privado

```
$ cd /opt/plane
$ ./backup.sh                          # sempre faça backup antes
$ git fetch origin
$ git log --oneline HEAD..origin/main  # veja o que vai entrar
$ git pull
$ docker compose build
$ docker compose up -d
$ docker compose logs migrator | tail -20
```

### 10.2 Trazer novidades do Plane oficial (upstream)

Faça isso numa máquina de desenvolvimento, nunca direto em produção. Nessa cópia, o remote `private` é o repositório privado e o `origin` é o Plane oficial. Nada é enviado ao Plane oficial: você só **baixa** dele.

```
$ git remote -v                         # confira: private = plane-solux, origin = makeplane/plane
$ git fetch origin                      # baixa as novidades do Plane oficial
$ git checkout main                     # a main local acompanha private/main
$ git merge origin/preview
# resolva conflitos, rode os testes de acesso e depois:
$ git push private main
```

A feature mexe em arquivos centrais (`Issue.issue_objects`, views e serializers de issue e módulo), então **conflitos são prováveis** em versões grandes. Resolva com cuidado, rode os testes de acesso (seção 8.1) e a checagem do repositório (`pnpm check`). Se o upstream adicionar migrations, o arquivo `apps/api/migrations_lockfile.txt` pode conflitar: regenere a sua migration (`makemigrations`) conforme o `AGENTS.md`.

### 10.3 Migrations e compatibilidade

Migrations rodam sozinhas no `up -d` (serviço `migrator`). As migrations desta feature (`0126`, `0127`) **só adicionam** tabelas, colunas com valor padrão e alteram um default. Não removem dados.

### 10.4 Rollback

1. Volte o código: `git checkout HASH_ANTERIOR` (o hash que você anotou no passo 3).
2. Restaure o banco do backup feito **antes** da atualização (seção 9.2): se a nova versão criou migrations, o banco antigo não conhece as colunas novas e vice-versa.
3. `docker compose build && docker compose up -d`.

---

## 11. Segurança: checklist

- [ ] Só as portas 80, 443 e SSH abertas; SSH só por chave, sem login de `root`.
- [ ] `DEBUG=0` em `apps/api/.env`.
- [ ] Senhas e `SECRET_KEY`/`LIVE_SERVER_SECRET_KEY` geradas aleatoriamente (nada de `plane`/`secret-key`).
- [ ] `.env` com permissão `600` e **fora do git** (já estão no `.gitignore`).
- [ ] HTTPS ativo e `MINIO_ENDPOINT_SSL=1`.
- [ ] Cadastro aberto desativado, se a instância for interna (7.7).
- [ ] Backups diários e **copiados para fora** da máquina (9.1).
- [ ] Atualizações de segurança do SO (`sudo apt-get install unattended-upgrades`).
- [ ] RabbitMQ (15672), MinIO (9000/9090), PostgreSQL (5432) e Redis (6379) **sem** `ports:` no compose.
- [ ] Monitoramento simples: `docker compose ps` num cron, ou um serviço externo (UptimeRobot) em `https://SEU_DOMINIO/`.

---

## 12. Variações

### 12.1 PostgreSQL externo (RDS, Cloud SQL, etc.)

- Remova o serviço `plane-db` do compose e aponte `POSTGRES_HOST`/`DATABASE_URL` do `apps/api/.env` para o banco externo.
- **Importante:** configure **`jit = off`** no PostgreSQL externo (parâmetro `jit` no grupo de parâmetros do provedor). O filtro de acesso da feature faz o planejador estimar um custo alto e, com JIT ligado, a lista de módulos chega a levar segundos em projetos grandes (medido: ~9 s com JIT contra ~0,5 s sem JIT, com 300 módulos e 30 mil issues). O compose já passa `-c jit=off` ao banco embutido.

### 12.2 Armazenamento S3 externo (em vez do MinIO embutido)

No `apps/api/.env`: `USE_MINIO=0`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, e `AWS_S3_ENDPOINT_URL` (deixe vazio para a AWS S3). Configure CORS no bucket permitindo `https://SEU_DOMINIO`. Remova o serviço `plane-minio` do compose.

### 12.3 Construir as imagens em outra máquina (servidor pequeno)

Na máquina de build: `docker compose build`, depois `docker tag` e `docker push` para um registro privado (GHCR, Docker Hub). No servidor, troque `build:` por `image:` nos serviços do compose e rode `docker compose pull && docker compose up -d`.

### 12.4 Proxy reverso próprio (nginx, Traefik, Cloudflare Tunnel)

Remova o serviço `proxy` do compose e publique você mesmo os serviços internos. Reproduza o roteamento da seção 0 (`/`, `/god-mode/`, `/spaces/`, `/live/` com suporte a WebSocket, `/api/`, `/auth/`, `/static/`, `/uploads/`). Ajuste `NUM_PROXIES` conforme o número de saltos.

---

## 13. Problemas comuns

| Sintoma                                         | Causa provável                                                                    | O que fazer                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Proxy reinicia sem parar                        | `CERT_EMAIL` sem a palavra `email`, ou `SITE_ADDRESS` vazio                       | Corrija o `.env` da raiz; `docker compose up -d proxy`           |
| Sem HTTPS / certificado inválido                | DNS ainda não aponta para a máquina; portas 80/443 bloqueadas                     | `dig SEU_DOMINIO`; libere as portas; `docker compose logs proxy` |
| `live` sai com "Invalid environment variables"  | Falta `apps/live/.env` ou `LIVE_SERVER_SECRET_KEY`                                | Refaça o 4.1; `docker compose up -d live`                        |
| Tela de login sem botão do Google               | Google ainda não ativado no `/god-mode/`                                          | Seção 7.6                                                        |
| `redirect_uri_mismatch` no Google               | URI cadastrada diferente (falta a `/` final ou o `https`)                         | Corrija no Google Cloud                                          |
| Upload de imagem/arquivo falha                  | `AWS_*` diferentes entre `.env` e `apps/api/.env`, ou `MINIO_ENDPOINT_SSL` errado | Alinhe as chaves; `docker compose logs api plane-minio`          |
| Convites/e-mails não chegam                     | SMTP não configurado                                                              | Seção 7.2                                                        |
| API responde 502 logo após subir                | Migrations ainda rodando                                                          | `docker compose logs migrator`; aguarde                          |
| `Killed` durante o build                        | Falta de memória                                                                  | Seção 2.3 ou 12.3                                                |
| Lista de módulos lenta em projeto grande        | JIT do PostgreSQL ligado (banco externo)                                          | Seção 12.1                                                       |
| Usuário vê tudo em inglês                       | Perfil criado com idioma `en`                                                     | Seção 7.5                                                        |
| "Failed to upload cover image" ao criar projeto | MinIO inacessível ou chaves erradas                                               | Mesmas verificações do upload                                    |
| Nome de projeto recusado                        | Hífen e acentos não são aceitos                                                   | Use só letras e números, ex.: `Domus`                            |

Comandos úteis:

```
$ docker compose ps
$ docker compose logs --tail=100 api
$ docker compose logs --tail=100 worker
$ docker compose restart api worker beat-worker
$ docker compose exec api python manage.py showmigrations db | tail -5
$ docker stats --no-stream
$ df -h && docker system df
```

---

## 14. Checklist final

- [ ] DNS aponta para a máquina e HTTPS responde com certificado válido.
- [ ] `docker compose ps` mostra tudo `Up` e o `migrator` com `Exited (0)`.
- [ ] Migrations `0126` e `0127` aplicadas; `show jit;` retorna `off`.
- [ ] Admin da instância criado em `/god-mode/`; cadastro aberto desativado (se aplicável).
- [ ] SMTP testado.
- [ ] Workspace, projeto e usuários criados; idioma em português.
- [ ] Roteiro de testes da feature de acesso (seção 8) executado com 3 contas.
- [ ] Backup automático ativo, copiado para fora da máquina e restauração testada.
- [ ] Deploy key somente leitura cadastrada no repositório privado.
- [ ] Hash do commit implantado anotado.
- [ ] Senhas e `.env` guardados em local seguro.
