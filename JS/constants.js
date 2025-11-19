/* js/constants.js — Constantes e Fallback Data */

export const CHANNEL_NAME = 'el_shaday_channel_v1';
export const LS_ORDERS_KEY = 'el_shaday_orders_v1';
export const LS_PRODUCTS_KEY = 'el_shaday_products_v1';
export const LS_CART_KEY = 'el_shaday_cart_v1';
export const LS_DRAFTS_KEY = 'el_shaday_drafts_v1';
export const DRAFT_ID_KEY = 'el_shaday_client_id_v1';

export const produtosEmbedded = {
    "nome_loja":"El Shaday Lanchonete",
    "categorias":[
        {"nome":"Pastéis","itens":[
            {"id":"p1","nome":"Pastel Grande (G)","preco":12.00,"descricaoDetalhada":"Sabores: Queijo, Carne, Frango, Pizza, Calabresa com queijo. Adicionais: Bacon (+R$3), Ovo (+R$2)."}, 
            {"id":"p2","nome":"Pastel de Carne","preco":14.00}
        ]},
        {"nome":"Lanches","itens":[
            {"id":"l1","nome":"Misto","preco":7.00},
            {"id":"l2","nome":"X-Egg","preco":10.00},
            {"id":"l3","nome":"X-Bacon","preco":14.00}
        ]},
        {"nome":"Bebidas","itens":[
            {"id":"b1","nome":"Coca-Cola Lata","preco":6.00},
            {"id":"b2","nome":"Água Mineral","preco":3.00}
        ]}
    ]
};