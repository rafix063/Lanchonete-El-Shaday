/* js/menu.js — Lógica de Carregamento e Renderização do Cardápio */
import { formatMoney } from './utils.js';
import { LS_PRODUCTS_KEY, produtosEmbedded } from './constants.js';
import { addToCart } from './cart.js'; // Importa a função para o botão 'Adicionar'

export function toggleCategory(catId, headerElement) {
    const listEl = document.getElementById(`list-${catId}`);
    if (listEl) {
        headerElement.closest('.category').classList.toggle('active');
    }
}

export function getProductById(id, productsData){
    if (!productsData || !productsData.categorias) return null;
    for(const category of productsData.categorias){
        const product = category.itens.find(item => item.id === id);
        if(product) return product;
    }
    return null;
}

export function renderMenu(data){
    const menuEl = document.getElementById('menu');
    if(!menuEl) return;

    // Coloca a função no escopo global para que o onclick no HTML funcione
    window.toggleCategory = toggleCategory; 

    menuEl.innerHTML = data.categorias.map((cat, index) => {
        const catId = cat.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const isActive = '';
        return `
            <div class="category ${isActive}">
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
                                    ${item.descricaoDetalhada ? `<small class="muted">${item.descricaoDetalhada}</small>` : ''}
                                    <div class="item-price">${formatMoney(item.preco)}</div>
                                </div>
                                <button class="btn small" data-add="${item.id}">Adicionar</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

export async function loadProducts(){
    try{
        const response = await fetch('data/produtos.json');
        if(!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify(data));
        return data;
    }catch(e){
        try{
            const localData = JSON.parse(localStorage.getItem(LS_PRODUCTS_KEY));
            if(localData) return localData;
        } catch(e) {}
        return produtosEmbedded;
    }
}