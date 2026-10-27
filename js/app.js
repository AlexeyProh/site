/* ==========================================================================
   OMA · каталог, карточка товара и выбор мастера
   ========================================================================== */
(function (global) {
    'use strict';

    var OMA = global.OMA;
    var $ = function (selector, root) { return (root || document).querySelector(selector); };
    var money = OMA.money;

    function cartLine(productId) {
        return OMA.getState().clientCart.items.filter(function (line) {
            return line.productId === productId;
        })[0] || null;
    }

    function buyControl(product) {
        var line = cartLine(product.id);
        var paid = OMA.getState().clientCart.status === 'paid';
        if (line && !paid) {
            return '<div class="qty qty--sm" role="group" aria-label="Количество">' +
                '<button type="button" data-step="-1" data-id="' + product.id + '" aria-label="Меньше">−</button>' +
                '<span>' + line.qty + '</span>' +
                '<button type="button" data-step="1" data-id="' + product.id + '" aria-label="Больше">+</button>' +
                '</div>';
        }
        if (line) {
            return '<span class="chip chip--green">в корзине · ' + line.qty + '</span>';
        }
        return '<button class="add-button" type="button" data-add="' + product.id + '"' + (paid ? ' disabled' : '') + '>В корзину</button>';
    }

    function productCard(product) {
        return '<article class="product-card">' +
            '<a href="product.html?id=' + product.id + '" class="product-image-wrap">' +
            '<img class="product-image" src="' + product.image + '" alt="' + product.name + '">' +
            '<span class="label label--' + product.tier + '">' + (global.TIERS[product.tier] || '') + '</span>' +
            '</a>' +
            '<span class="category">' + product.category + '</span>' +
            '<h3><a href="product.html?id=' + product.id + '">' + product.name + '</a></h3>' +
            '<div class="product-bottom">' +
            '<span class="price">' + money(product.price) + ' <small>BYN</small></span>' +
            buyControl(product) +
            '</div>' +
            '</article>';
    }

    /* Общие кнопки корзины на всех страницах каталога. */
    function bindCart() {
        document.addEventListener('click', function (event) {
            var add = event.target.closest('[data-add]');
            if (add) {
                var product = OMA.productById(Number(add.dataset.add));
                if (!product) return;
                var added = OMA.actions.clientAdd(product.id, 1);
                if (added && added.ok === false && added.message) global.OMAUI.toast(added.message, 'warn');
                else global.OMAUI.toast('Товар добавлен в корзину');
                return;
            }
            var step = event.target.closest('[data-step]');
            if (step) {
                var productId = Number(step.dataset.id);
                var line = cartLine(productId);
                var result = OMA.actions.clientSetQty(productId, (line ? line.qty : 0) + Number(step.dataset.step));
                if (result && result.ok === false && result.message) global.OMAUI.toast(result.message, 'warn');
            }
        });
    }

    /* ------------------------------------------------------------- каталог */

    function setupCatalog() {
        var searchInput = $('#search');
        var params = new URLSearchParams(location.search);
        var state = {
            tier: 'all',
            category: 'Все категории',
            sort: 'popular',
            search: params.get('search') || ''
        };

        searchInput.value = state.search;

        var categories = ['Все категории'].concat(Array.from(new Set(OMA.products().map(function (product) {
            return product.category;
        }))));
        var budgets = [['all', 'Все тарифы']].concat(Object.keys(global.TIERS).map(function (key) {
            return [key, global.TIERS[key]];
        }));

        function renderFilters() {
            $('#budget-filters').innerHTML = budgets.map(function (entry) {
                return '<button class="filter ' + (state.tier === entry[0] ? 'active' : '') + '" type="button" data-tier="' + entry[0] + '">' + entry[1] + '</button>';
            }).join('');
            $('#category-filters').innerHTML = categories.map(function (category) {
                return '<button class="filter ' + (state.category === category ? 'active' : '') + '" type="button" data-category="' + category + '">' + category + '</button>';
            }).join('');
        }

        function render() {
            var list = OMA.products().filter(function (product) {
                var byTier = state.tier === 'all' || product.tier === state.tier;
                var byCategory = state.category === 'Все категории' || product.category === state.category;
                var bySearch = product.name.toLowerCase().indexOf(state.search.toLowerCase()) !== -1;
                return byTier && byCategory && bySearch;
            });
            if (state.sort === 'priceAsc') list.sort(function (a, b) { return a.price - b.price; });
            if (state.sort === 'priceDesc') list.sort(function (a, b) { return b.price - a.price; });

            $('#result-count').textContent = list.length + ' товаров в каталоге';
            $('#product-grid').innerHTML = list.length
                ? list.map(productCard).join('')
                : '<div class="empty">По вашему запросу ничего не найдено</div>';
            renderFilters();
        }

        searchInput.addEventListener('input', function () {
            state.search = searchInput.value;
            render();
        });
        $('#sort').addEventListener('change', function (event) {
            state.sort = event.target.value;
            render();
        });
        document.addEventListener('click', function (event) {
            var tierButton = event.target.closest('[data-tier]');
            var categoryButton = event.target.closest('[data-category]');
            if (tierButton) {
                state.tier = tierButton.dataset.tier;
                render();
            }
            if (categoryButton) {
                state.category = categoryButton.dataset.category;
                render();
            }
        });

        render();
        /* корзина меняется — обновляем кнопки на карточках */
        OMA.subscribe(render);
    }

    /* --------------------------------------------------------- карточка товара */

    function setupProduct() {
        var id = Number(new URLSearchParams(location.search).get('id'));
        var product = OMA.productById(id) || OMA.products()[0];
        var host = $('#product-detail');

        function render() {
            var line = cartLine(product.id);
            var paid = OMA.getState().clientCart.status === 'paid';
            host.innerHTML =
                '<section class="detail">' +
                '<div class="detail-crumbs"><a href="index.html">Каталог</a> / ' + product.category + ' / ' + product.name + '</div>' +
                '<div class="detail-grid">' +
                '<img class="detail-image" src="' + product.image + '" alt="' + product.name + '">' +
                '<div class="detail-info">' +
                '<span class="eyebrow">' + (global.TIERS[product.tier] || '') + ' тариф</span>' +
                '<h1>' + product.name + '</h1>' +
                '<span class="price">' + money(product.price) + ' BYN</span>' +
                '<p class="detail-description">' + product.description + '</p>' +
                '<div class="specs">' + product.specs.map(function (spec) {
                    return '<div><span>' + spec[0] + '</span>' + spec[1] + '</div>';
                }).join('') + '</div>' +
                '<div class="detail-actions">' +
                '<button class="button button-dark" id="detail-add" type="button"' + (paid ? ' disabled' : '') + '>' +
                (line ? 'Добавить ещё · в корзине ' + line.qty : 'Добавить в корзину') + '</button>' +
                '<a class="button button-ghost" href="masters.html">Подобрать мастера</a>' +
                '</div>' +
                '<p class="detail-note" id="detail-note"></p>' +
                '</div></div>' +
                '<section class="related"><span class="eyebrow">Вам может понравиться</span><h2>Другие материалы</h2>' +
                '<div class="product-grid">' + OMA.products().filter(function (item) {
                    return item.id !== product.id;
                }).slice(0, 3).map(productCard).join('') + '</div></section>' +
                '</section>';

            var addButton = $('#detail-add');
            if (addButton) addButton.addEventListener('click', add);
        }

        function add() {
            var result = OMA.actions.clientAdd(product.id, 1);
            if (result && result.ok === false && result.message) {
                global.OMAUI.toast(result.message, 'warn');
                return;
            }
            global.OMAUI.toast('Товар добавлен в корзину');
            var note = $('#detail-note');
            if (note) {
                note.innerHTML = 'В корзине: <b>' + OMA.cartCount(OMA.getState().clientCart) + '</b> · ' +
                    'Итого: <b>' + money(OMA.cartTotal(OMA.getState().clientCart)) + ' BYN</b> · ' +
                    '<a href="client.html#cart">Перейти в корзину →</a>';
            }
        }

        render();
        OMA.subscribe(render);
    }

    /* ------------------------------------------------------- выбор мастера */

    function setupMasters() {
        var grid = $('#master-grid');
        var panel = $('#estimate');

        function renderGrid() {
            var current = OMA.getState();
            grid.innerHTML = OMA.masters().map(function (master) {
                var selected = current.activeMasterId === master.id;
                return '<article class="master-card' + (selected ? ' master-card--selected' : '') + '">' +
                    '<div class="master-top">' +
                    '<img class="avatar" src="' + master.image + '" alt="' + master.name + '">' +
                    '<div><h3>' + master.name + '</h3>' +
                    '<span class="rating">★ ' + master.rating + '</span> <small>(' + master.reviews + ' отзывов)</small></div>' +
                    '</div>' +
                    '<p><b>' + master.specialty + '</b><br>' + master.experience + ' · ' + master.city + '</p>' +
                    '<div class="master-tags">' + master.tags.map(function (tag) {
                        return '<span>' + tag + '</span>';
                    }).join('') + '</div>' +
                    '<button class="button ' + (selected ? 'button-ghost' : 'button-dark') + ' master-card__cta" type="button" data-master="' + master.id + '">' +
                    (selected ? 'Открыть чат' : 'Выбрать мастера') + '</button>' +
                    '</article>';
            }).join('');
        }

        function renderPanel() {
            var current = OMA.getState();
            var cart = current.clientCart;
            var master = OMA.masterById(current.activeMasterId);
            var chat = master ? OMA.chatFor(current, master.id) : null;
            var last = chat && chat.messages.length ? chat.messages[chat.messages.length - 1] : null;

            panel.innerHTML =
                '<h2>Ваш ремонт</h2>' +
                '<p class="estimate-empty">' + (master
                    ? 'Мастер: <b>' + master.name + '</b>. Обсудите проект в чате — мастер соберёт корзину с материалами.'
                    : 'Выберите мастера слева: с ним откроется чат и появится корзина материалов.') + '</p>' +
                '<hr style="border-color:#494536;margin:20px 0">' +
                '<h3>Корзина клиента</h3>' +
                (cart.items.length
                    ? cart.items.map(function (item) {
                        return '<div class="estimate-row"><span>' + item.name + ' × ' + item.qty + '</span><b>' +
                            money(item.price * item.qty) + ' BYN</b></div>';
                    }).join('') +
                    '<div class="estimate-total"><span>Итого</span><span>' + money(OMA.cartTotal(cart)) + ' BYN</span></div>'
                    : '<p class="estimate-empty">Пока пусто — добавьте материалы из каталога.</p>') +
                (last ? '<hr style="border-color:#494536;margin:20px 0"><h3>Последнее в чате</h3>' +
                    '<p class="estimate-empty">' + (last.from === 'client' ? 'Вы: ' : 'Мастер: ') + last.text + '</p>' : '') +
                '<div class="estimate-actions">' +
                (master
                    ? '<a class="button button-light" href="client.html#chat">Открыть чат и корзину</a>'
                    : '<a class="button button-light" href="client.html">В кабинет клиента</a>') +
                '</div>';
        }

        grid.addEventListener('click', function (event) {
            var button = event.target.closest('[data-master]');
            if (!button) return;
            var masterId = Number(button.dataset.master);
            OMA.actions.selectMaster(masterId);
            global.OMAUI.toast('Мастер выбран — открываем чат');
            location.href = 'client.html#chat';
        });

        renderGrid();
        renderPanel();
        OMA.subscribe(function () {
            renderGrid();
            renderPanel();
        });
    }

    /* ---------------------------------------------------------------- старт */

    document.addEventListener('DOMContentLoaded', function () {
        global.OMAUI.boot();
        bindCart();
        var page = document.body.dataset.page;
        if (page === 'catalog') setupCatalog();
        if (page === 'product') setupProduct();
        if (page === 'masters') setupMasters();
    });
})(window);
