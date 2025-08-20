// js/storageManager.js

// Verifica se o código está rodando dentro do WebView do Android
const IS_ANDROID = typeof window.Android !== 'undefined';

/**
 * Função "replacer" para JSON.stringify, que converte Map para um formato serializável.
 */
function replacer(key, value) {
  if (value instanceof Map) {
    return { _dataType: 'Map', value: Array.from(value.entries()) };
  }
  return value;
}

/**
 * Função "reviver" para JSON.parse, que reconstrói um Map a partir do formato serializado.
 */
function reviver(key, value) {
  if (typeof value === 'object' && value !== null && value._dataType === 'Map') {
    return new Map(value.value);
  }
  return value;
}

/**
 * Salva um valor associado a uma chave. Lida com a serialização automaticamente.
 * @param {string} key A chave de armazenamento.
 * @param {any} value O valor a ser salvo (pode ser um objeto com Maps).
 */
export function salvar(key, value) {
  try {
    const serializedValue = JSON.stringify(value, replacer);
    if (IS_ANDROID) {
      window.Android.salvarDados(key, serializedValue);
    } else {
      localStorage.setItem(key, serializedValue);
    }
    return true;
  } catch (error) {
    console.error("Falha ao salvar dados:", error);
    return false;
  }
}

/**
 * Carrega um valor associado a uma chave. Lida com a desserialização automaticamente.
 * @param {string} key A chave de armazenamento.
 * @returns {any | null} O valor carregado ou null se não for encontrado/houver erro.
 */
export function carregar(key) {
  try {
    let rawValue;
    if (IS_ANDROID) {
      // Supõe que a interface Android retorne o valor string ou null
      rawValue = window.Android.carregarDados(key); 
    } else {
      rawValue = localStorage.getItem(key);
    }
    
    if (rawValue) {
      return JSON.parse(rawValue, reviver);
    }
    return null;
  } catch (error) {
    console.error("Falha ao carregar dados:", error);
    return null;
  }
}