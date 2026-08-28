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
- **Notas por bimestre**: AV1 (peso 3), AV2 (peso 5) e AV3 (peso 2), com média
  calculada automaticamente: `(AV1×3 + AV2×5 + AV3×2) ÷ 10`. Clique numa nota
  para editá-la direto na tabela. Veja o histórico de cada matéria nos 4
  bimestres num gráfico.
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

Como o projeto usa ES Modules, é preciso servir os arquivos por HTTP (abrir o
`index.html` direto com `file://` não funciona nos navegadores modernos).

Opção mais simples (precisa de [Node.js](https://nodejs.org) instalado):

```bash
npm start
```

Isso abre o site em `http://localhost:5173`. Qualquer outro servidor estático
funciona também (por exemplo, a extensão "Live Server" do VS Code).

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
