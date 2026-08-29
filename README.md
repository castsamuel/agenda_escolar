# 📔 Agenda Escolar

Uma agenda escolar digital, moderna e responsiva, para organizar escolas, séries,
matérias, deveres, trabalhos, notas por bimestre e desempenho acadêmico —
funcionando inteiramente no navegador, sem servidor/backend, pronta para o
**GitHub Pages**.

## Funcionalidades

- **Escolas e séries**: cadastre várias escolas, cada uma com suas séries. Os
  dados de matérias, notas, deveres e trabalhos ficam sempre isolados por
  escola/série.
- **Matérias**: nome, professor (opcional) e cor de identificação.
- **Deveres de casa**: título, descrição, prazo e status (Pendente / Concluído /
  Atrasado, com detecção automática de atraso). Busca, filtros por matéria e
  status, ordenação por prazo.
- **Trabalhos**: mesma ideia dos deveres, com data de início, prazo e 4 status
  (Não iniciado / Em andamento / Concluído / Atrasado).
- **Notas por bimestre**: AV1 (até 3 pontos), AV2 (até 5 pontos) e AV3 (até
  2 pontos). O total do bimestre é a **soma direta** dos pontos obtidos —
  `AV1 + AV2 + AV3`, até 10 pontos — e **não** uma média ponderada. Clique
  numa nota para editá-la direto na tabela. Veja o histórico de cada matéria
  nos 4 bimestres num gráfico.
- **Nota mínima configurável**, usada para calcular a situação acadêmica
  (🟢 Aprovado / 🟡 Recuperação / 🔴 Reprovado).
- **Desempenho**: comparação entre os 4 bimestres, evolução da média geral,
  comparação entre matérias, melhor/pior bimestre e quais matérias
  melhoraram ou pioraram.
- **Calendário escolar**: mostra deveres, trabalhos e eventos manuais; clique
  num dia para ver os detalhes.
- **Dashboard**: resumo do dia a dia — média geral, situação, próximos prazos
  e pendências.
- **Exportar / importar dados** em JSON, para fazer backup ou levar seus dados
  para outro navegador/computador.
- **Responsivo**: barra lateral no computador, navegação inferior no celular.

## Tecnologias

- HTML, CSS e JavaScript puros (ES Modules) — sem framework e sem etapa de
  build, o que torna a publicação no GitHub Pages direta.
- [Chart.js](https://www.chartjs.org/) (via CDN) para os gráficos.
- `localStorage` do navegador para persistência dos dados.
- GitHub Actions para publicar automaticamente no GitHub Pages a cada push.

## Estrutura do projeto

```text
agenda-escolar/
├── index.html                 # ponto de entrada
├── package.json                # apenas script opcional de servidor local
├── src/
│   ├── styles/
│   │   └── main.css            # design system (tema "caderno")
│   └── js/
│       ├── app.js              # shell da aplicação e roteador (hash routing)
│       ├── db.js                # camada de persistência (localStorage)
│       ├── selectors.js         # leituras derivadas do estado (médias, filtros)
│       ├── utils.js             # formatação, validação, toasts, confirmações
│       ├── components/
│       │   ├── modal.js
│       │   ├── charts.js
│       │   └── emptyGuards.js
│       └── pages/
│           ├── dashboard.js
│           ├── schools.js
│           ├── subjects.js
│           ├── homework.js
│           ├── works.js
│           ├── grades.js
│           ├── performance.js
│           ├── calendar.js
│           └── settings.js
└── .github/workflows/deploy.yml  # publica no GitHub Pages a cada push na main
```

## Como executar localmente

Basta abrir o arquivo `index.html` duas vezes (clique duplo) — ele carrega
`src/js/app.bundle.js`, um script único e comum (não é um ES Module), então
funciona direto pelo `file://`, sem precisar de servidor.

Se preferir servir por HTTP mesmo assim (opcional, precisa de
[Node.js](https://nodejs.org)):

```bash
npm start
```

Isso abre o site em `http://localhost:5173`.

### Sobre o `app.bundle.js`

Os arquivos em `src/js/*.js` e `src/js/pages/*.js` e `src/js/components/*.js`
são a versão "fonte", organizada em módulos, para facilitar leitura e
manutenção. O `index.html` carrega, na prática, o `src/js/app.bundle.js`,
que reúne todo esse código num único arquivo sem `import`/`export`. Isso
evita o problema de módulos ES bloqueados por CORS quando o site é aberto
direto do disco (`file://`) e também remove qualquer risco de arquivo
"faltando" ao publicar — é um só arquivo de JavaScript. Se você editar os
arquivos-fonte, peça para eu regenerar o `app.bundle.js` a partir deles.

## Se o site abrir em branco

- Confira no console do navegador (F12 → Console) se aparece algum erro.
- Confirme que a pasta `src/` inteira foi enviada junto — o `index.html`
  sozinho não funciona.
- Se você editou algo e quebrou o `app.bundle.js`, restaure a partir dos
  arquivos-fonte em `src/js/`.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub (por exemplo, `agenda-escolar`) e envie todo
   este projeto para ele:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão da Agenda Escolar"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/agenda-escolar.git
   git push -u origin main
   ```
2. No GitHub, abra o repositório e vá em **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. Pronto. O workflow em `.github/workflows/deploy.yml` já está configurado:
   a cada `push` na branch `main`, o GitHub Actions publica o site
   automaticamente. Acompanhe o progresso na aba **Actions** do repositório.
5. Quando o workflow terminar, o link do site aparece em **Settings → Pages**
   (algo como `https://SEU-USUARIO.github.io/agenda-escolar/`).

## Como atualizar o site

Basta enviar novos commits para a branch `main` (`git push`). O GitHub
Actions detecta o push e publica a nova versão automaticamente — não é
necessário nenhum passo manual adicional.

## Como funciona o armazenamento dos dados

Todos os dados (escolas, séries, matérias, notas, deveres, trabalhos e
eventos) ficam salvos no `localStorage` do seu navegador, no dispositivo em
que você está usando a agenda. Isso significa que:

- Os dados continuam lá mesmo depois de fechar o navegador ou desligar o
  computador.
- Os dados **não são sincronizados automaticamente** entre navegadores ou
  dispositivos diferentes (não há servidor/backend).
- Limpar o cache/dados de navegação do navegador apaga os dados da agenda.

## Como fazer backup dos dados

Vá em **Configurações**:

- **Exportar dados**: baixa um arquivo `.json` com tudo que está salvo.
- **Importar dados**: escolhe um arquivo `.json` exportado anteriormente e
  restaura os dados (substituindo os dados atuais do navegador).

Recomenda-se exportar um backup regularmente e sempre que for trocar de
navegador ou computador.

## Licença

MIT — sinta-se livre para adaptar.
