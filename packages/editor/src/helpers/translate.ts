/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/**
 * Lightweight UI-text translation for the editor package.
 *
 * `@plane/editor` does not depend on `@plane/i18n` (and is also consumed server-side by the live
 * server), so the editor's own UI strings are translated here. The active language is read at call
 * time from the same sources `@plane/i18n` writes to (`localStorage.userLanguage` and `<html lang>`),
 * so the text follows the user's language without any provider. Unknown languages, and any text not
 * in a dictionary, fall back to the English source string.
 */

// localStorage key used by @plane/i18n (LANGUAGE_STORAGE_KEY)
const LANGUAGE_STORAGE_KEY = "userLanguage";

const PT_BR: Record<string, string> = {
  // slash commands / block types
  Text: "Texto",
  "Just start typing with plain text.": "Comece a digitar com texto simples.",
  "Heading 1": "Título 1",
  "Heading 2": "Título 2",
  "Heading 3": "Título 3",
  "Heading 4": "Título 4",
  "Heading 5": "Título 5",
  "Heading 6": "Título 6",
  "Heading {level}": "Título {level}",
  "Big section heading.": "Título de seção grande.",
  "Medium section heading.": "Título de seção médio.",
  "Small section heading.": "Título de seção pequeno.",
  "Numbered list": "Lista numerada",
  "Create a numbered list.": "Criar uma lista numerada.",
  "Bulleted list": "Lista com marcadores",
  "Create a bulleted list.": "Criar uma lista com marcadores.",
  "To-do list": "Lista de verificação",
  "Create a to-do list.": "Criar uma lista de verificação.",
  Table: "Tabela",
  "Create a table": "Criar uma tabela",
  Quote: "Citação",
  "Capture a quote.": "Inserir uma citação.",
  Code: "Código",
  "Capture a code snippet.": "Inserir um trecho de código.",
  Callout: "Destaque",
  "Insert callout": "Inserir destaque",
  Divider: "Divisor",
  "Visually divide blocks.": "Dividir blocos visualmente.",
  Emoji: "Emoji",
  "Insert an emoji": "Inserir um emoji",
  Colors: "Cores",
  Default: "Padrão",
  "Change text color": "Alterar cor do texto",
  "Background colors": "Cores de fundo",
  "Text colors": "Cores do texto",
  "Default background": "Fundo padrão",
  "Change background color": "Alterar cor de fundo",
  Image: "Imagem",
  "Insert an image": "Inserir uma imagem",
  "Press '/' for commands...": "Pressione '/' para ver os comandos...",
  Untitled: "Sem título",
  "No emojis found": "Nenhum emoji encontrado",
  "Loading...": "Carregando...",
  "No results": "Nenhum resultado",
  // colors
  Gray: "Cinza",
  Peach: "Pêssego",
  Pink: "Rosa",
  Orange: "Laranja",
  Green: "Verde",
  "Light blue": "Azul claro",
  "Dark blue": "Azul escuro",
  Purple: "Roxo",
  Color: "Cor",
  "Background color": "Cor de fundo",
  "{color} text color": "Cor do texto {color}",
  "{color} background color": "Cor de fundo {color}",
  "Clear text color": "Limpar cor do texto",
  "Clear background color": "Limpar cor de fundo",
  // formatting
  Bold: "Negrito",
  Italic: "Itálico",
  Underline: "Sublinhado",
  Strikethrough: "Tachado",
  "Left align": "Alinhar à esquerda",
  "Center align": "Centralizar",
  "Right align": "Alinhar à direita",
  "Align left": "Alinhar à esquerda",
  "Align center": "Centralizar",
  "Align right": "Alinhar à direita",
  "Text align": "Alinhamento do texto",
  "Text alignment": "Alinhamento do texto",
  "Formatting toolbar": "Barra de formatação",
  "Text formatting": "Formatação de texto",
  Multiple: "Vários",
  // links
  Link: "Link",
  "Link URL": "URL do link",
  "Enter or paste a link": "Digite ou cole um link",
  "Enter or paste URL": "Digite ou cole a URL",
  "Enter Text to display": "Digite o texto a exibir",
  "Apply link": "Aplicar link",
  "Copy link": "Copiar link",
  "Edit link": "Editar link",
  "Remove link": "Remover link",
  // block menu / tables
  Delete: "Excluir",
  Duplicate: "Duplicar",
  "Fit to width": "Ajustar à largura",
  "Insert left": "Inserir à esquerda",
  "Insert right": "Inserir à direita",
  "Insert above": "Inserir acima",
  "Insert below": "Inserir abaixo",
  "Clear contents": "Limpar conteúdo",
  "Header column": "Coluna de cabeçalho",
  "Header row": "Linha de cabeçalho",
  "Column options": "Opções da coluna",
  "Row options": "Opções da linha",
  "Insert columns": "Inserir colunas",
  "Insert rows": "Inserir linhas",
  // code block
  "Copy code": "Copiar código",
  "Copied code": "Código copiado",
  // images
  Left: "Esquerda",
  Center: "Centro",
  Right: "Direita",
  Align: "Alinhar",
  "Align image": "Alinhar imagem",
  "Align image {alignment}": "Alinhar imagem: {alignment}",
  "Image alignment": "Alinhamento da imagem",
  "Image controls": "Controles da imagem",
  "Error loading image": "Erro ao carregar a imagem",
  "Uploading...": "Enviando...",
  "Drop image here": "Solte a imagem aqui",
  "Add an image": "Adicionar uma imagem",
  "Choose image": "Escolher imagem",
  Retry: "Tentar novamente",
  "Retry duplication": "Tentar duplicar novamente",
  Download: "Baixar",
  "Download image": "Baixar imagem",
  "View in full screen": "Ver em tela cheia",
  "View image in full screen": "Ver imagem em tela cheia",
  "Fullscreen image viewer": "Visualizador de imagem em tela cheia",
  "Close image viewer": "Fechar visualizador de imagem",
  Preview: "Pré-visualização",
  "Image viewer controls": "Controles do visualizador de imagem",
  "Image zoom": "Zoom da imagem",
  "Zoom out": "Diminuir zoom",
  "Zoom in": "Aumentar zoom",
  "Open image in new tab": "Abrir imagem em nova aba",
};

const DICTIONARIES: Record<string, Record<string, string>> = {
  "pt-br": PT_BR,
};

const getCurrentLanguage = (): string => {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored) return stored.toLowerCase();
  } catch {
    // storage can be unavailable (private mode, blocked site data)
  }
  return (document?.documentElement?.lang || "en").toLowerCase();
};

const interpolate = (text: string, params?: Record<string, string | number>): string =>
  params ? text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match)) : text;

/**
 * Translates an editor UI string (English source text) to the current user language.
 * @param text - English source text, also used as the lookup key
 * @param params - optional `{name}` placeholders to interpolate
 */
export const translateEditorText = (text: string, params?: Record<string, string | number>): string => {
  const dictionary = DICTIONARIES[getCurrentLanguage()];
  return interpolate(dictionary?.[text] ?? text, params);
};
