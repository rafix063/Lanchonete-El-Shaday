/* js/menu.js — Lógica do Cardápio */
import { formatMoney } from './utils.js';
import { LS_PRODUCTS_KEY, produtosEmbedded } from './constants.js';

/* === Alternância de categoria (accordion) === */
export function toggleCategory(catId, headerElement) {
    const listEl = document.getElementById(`list-${catId}`);
    if (!listEl) return;

    const category = headerElement.closest('.category');
    category.classList.toggle('active');
}

/* === Buscar produto pelo ID === */
export function getProductById(id, productsData){
    if (!productsData || !productsData.categorias) return null;

    for (const cat of productsData.categorias){
        const found = cat.itens.find(item => item.id === id);
        if (found) return found;
    }
    return null;
}

/* === Renderização do Cardápio === */
export function renderMenu(data){
    const menuEl = document.getElementById('menu');
    if (!menuEl) return;

    window.toggleCategory = toggleCategory;

    menuEl.innerHTML = data.categorias.map(cat => {
        const catId = cat.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');

        return `
            <div class="category">
                <div class="category-header" onclick="toggleCategory('${catId}', this)">
                    <h2>${cat.nome}</h2>
                    <span class="toggle-icon">▼</span>
                </div>

                <div class="items-list" id="list-${catId}">
                    ${cat.itens.map(item => `
                        <div class="menu-item" data-item-id="${item.id}">
                            <div class="item-header">
                                <div class="item-info">
                                    <div class="item-name">${item.nome}</div>

                                    ${
                                        item.descricaoDetalhada
                                        ? `<small class="muted">${item.descricaoDetalhada}</small>`
                                        : ''
                                    }

                                    <div class="item-price">${formatMoney(item.preco)}</div>
                                </div>

                                <button class="btn small" data-add="${item.id}">
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

/* === Carregamento dos produtos === */
export async function loadProducts(){
    try {
        const res = await fetch('data/produtos.json', { cache: "no-store" });

        if (!res.ok) throw new Error("Erro ao carregar JSON");
        
        const data = await res.json();
        localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify(data));
        return data;

    } catch (e) {
        // Tenta localStorage
        try {
            const localData = JSON.parse(localStorage.getItem(LS_PRODUCTS_KEY));
            if (localData) return localData;
        } catch {}

        // Fallback embedado
        return produtosEmbedded;
    }
}
