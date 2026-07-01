# NFS-e Automation — ISS Web (Fiorilli)

![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-latest-40B5A4?logo=puppeteer&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

Automação em **Node.js + Puppeteer** para emissão de **NFS-e** em portais **ISS Web da Fiorilli**, lendo uma planilha Excel com dados dos tomadores e interagindo no site como um usuário humano.

> ⚠️ **Aviso:** Este projeto automatiza um processo sensível (emissão fiscal). Use credenciais próprias e revise as regras do município antes de utilizar em produção.

---

## Interface

> Tela de **Configuracoes** — credenciais, parametros de emissao e planilha

![Configuracoes](new_ui/Print%201.png)

> Tela de **Execucao e Logs** — acompanhamento em tempo real da automacao

![Execucao](new_ui/Print%202.png)

---

## Tecnologias

| Tecnologia        | Uso                                      |
| ----------------- | ---------------------------------------- |
| **Node.js**       | Runtime                                  |
| **Puppeteer**     | Automação do navegador (Chrome/Chromium) |
| **xlsx**          | Leitura e escrita de planilhas Excel     |
| **fs-extra**      | Utilitários de arquivos                  |
| **logger** custom | Logs por dia com timestamp               |

---

## Funcionalidades

- 🔐 Login automático com **reuso de cookies** (evita relogar quando já autenticado)
- 🧠 Detecção idempotente de sessão
- 📝 Preenchimento automático de:
  - Tipo de pessoa (Física)
  - CPF — múltiplas tentativas com fallback para pular o registro
  - Atividade Municipal, NBS, Código Indicador e Classificação Tributária
  - Mensagem/descrição (templates por código de serviço)
  - Valor (com validação de formato e rejeição de `0` ou inválido)
- ✅ Adição de item, salvamento e confirmação da nota
- 🧾 Captura dos dados da NFS-e emitida (número, código de verificação, etc.)
- 💾 Atualização da planilha marcando `PROCESSADO = "SIM"`
- 🔁 Marcação automática de **duplicados** (mesmo tomador + CPF + valor)
- 📋 Logs detalhados e encerramento seguro via `CTRL+C`

---

## Estrutura do Projeto

```
NFS-E-AUTOMATION/
├── logs/                       # Logs rotacionados por data (gerado em runtime)
├── modules/
│   ├── aluno.js                # Helpers: CPF, mensagem, valor, salvar, etc.
│   ├── controleExecucao.js     # Encerramento seguro (graceful shutdown)
│   ├── logger.js               # Logger (arquivo + console)
│   ├── mensagens.js            # Templates de descrição por serviço
│   ├── navegador.js            # Inicialização do navegador
│   ├── notaEmitida.js          # Coleta das informações da NFS-e emitida
│   ├── planilha.js             # Leitura/atualização da planilha
│   └── processamento.js        # Fluxo principal por registro
├── ui/
│   ├── app.js                  # Lógica da interface gráfica
│   ├── index.html              # Interface web
│   └── style.css               # Estilos
├── config.js                   # Configurações gerais
├── cookies.json                # Cookies de sessão (gerado em runtime)
├── index.js                    # Script principal (loop de emissão)
├── server.js                   # Servidor da interface gráfica
├── START.bat                   # Atalho para iniciar no Windows
└── package.json
```

---

## Configuração

### 1. `config.js`

Parâmetros de comportamento da automação. Credenciais e planilha são informadas diretamente pela interface — o único parâmetro que pode precisar de ajuste manual é a **URL do portal**, que varia por município.

```js
export const CONFIG = {
  // 🌐 URL da página de emissão do portal ISS Web do seu município
  ISS_URL:
    "https://servicos.seumunicipio.gov.br/issweb/paginas/admin/notafiscal/convencional/emissaopadrao",

  COOKIE_FILE: "cookies.json",

  // 📅 Data manual ("DD/MM/AAAA") — vazio usa a data do portal
  DATA_EMISSAO_MANUAL: "",

  // 🔄 Tentativas de CPF antes de pular o registro
  MAX_TENTATIVAS_CPF: 3,

  // Modos de execução
  SKIP_CONFIRMATION: false, // true = não clica "SIM" no modal
  TEST_MODE: false, // true = processa só 1 registro
  VERBOSE: false, // true = logs detalhados
};
```

### 2. `.gitignore` recomendado

```gitignore
cookies.json
logs/*.log
logs/*.txt
node_modules/
```

---

## Como rodar

```bash
npm install
node server.js
```

Acesse a interface pelo navegador. Por ela você:

1. Informa a **URL do portal** ISS Web do seu município
2. Informa o **usuário e senha** do portal
3. Seleciona a **planilha Excel** com os dados
4. Configura os parâmetros e inicia a automação

---

## Modos e Flags

| Flag                  | Efeito                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `SKIP_CONFIRMATION`   | Simula emissão sem confirmar o modal final (não clica em **SIM**) |
| `TEST_MODE`           | Processa apenas o primeiro registro pendente (debug rápido)       |
| `VERBOSE`             | Exibe logs estendidos (tentativas, detalhes do DOM, etc.)         |
| `MAX_TENTATIVAS_CPF`  | Número de tentativas de CPF antes de pular o registro             |
| `DATA_EMISSAO_MANUAL` | Força uma data específica; vazio usa a do portal                  |

---

## Exemplo de saída (logs)

```
[08-09-2025 09:08:20] [INFO] 🤖 Automação iniciada via interface gráfica.
[08-09-2025 09:08:20] [INFO] 📂 Carregando planilha...
[08-09-2025 09:08:20] [INFO] ✅ Planilha carregada com sucesso!
[08-09-2025 09:08:20] [INFO] 🌐 Abrindo navegador...
[08-09-2025 09:08:36] [INFO] ⏭️ Pulando registro no índice 0: já processado ou inválido.
[08-09-2025 09:08:36] [INFO] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[08-09-2025 09:08:36] [INFO] 👤 Aluno(a) selecionado(a): FULANO DA SILVA
[08-09-2025 09:08:42] [INFO] ⏳ Buscando cadastro... [Tentativa 1/3]
[08-09-2025 09:18:39] [INFO] ✅ Confirmação realizada, nota salva com sucesso!
[08-09-2025 09:18:59] [INFO] 💾 Aluno(a) "FULANO DA SILVA" marcado como PROCESSADO!
[08-09-2025 09:18:59] [INFO] ✅ Processamento da nota concluída!
```

---

## Solução de Problemas

**Registro não encontrado**
O CPF pode não estar cadastrado no portal. O sistema pula automaticamente após `MAX_TENTATIVAS_CPF` tentativas.

**Campos dependentes não carregam**
O portal usa AJAX para campos em cascata (NBS → Código Indicador → Classificação Tributária). Verifique se os códigos configurados existem no portal do seu município.

**Sessão expirada**
O sistema detecta automaticamente e refaz o login com as credenciais informadas na interface.

**Nota não confirmada**
Verifique se `SKIP_CONFIRMATION` está como `false` no `config.js`.

**Portal de outro município**
Ajuste a URL em `config.js` e revise os IDs dos campos em `aluno.js` caso o município use uma versão diferente do ISS Web.

---

## Contribuição

Contribuições são bem-vindas via **Issues** e **Pull Requests**. Para adaptar a outros municípios ou adicionar novos campos, abra uma issue descrevendo o caso.
