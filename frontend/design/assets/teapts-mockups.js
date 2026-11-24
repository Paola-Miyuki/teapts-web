(function () {
  'use strict';

  const glyphs = {
    home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    people:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5v2"/>',
    patient:
      '<circle cx="10" cy="7" r="4"/><path d="M3 21v-2a7 7 0 0 1 10.5-6.06"/><path d="M18 21s-4-2.4-4-5.1a2 2 0 0 1 4-.9 2 2 0 0 1 4 .9c0 2.7-4 5.1-4 5.1Z"/>',
    clipboard:
      '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6m-6 4h6"/>',
    accounts:
      '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 10h3m-3 4h3"/>',
    logout: '<path d="M9 3H4v18h5M10 12h11m-4-4 4 4-4 4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    sortDown: '<path d="M12 4v16m-6-6 6 6 6-6"/>',
    sortUp: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    phone: '<path d="M5 4h3.5l1.5 4-2.2 1.4a11 11 0 0 0 5.8 5.8L15 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/><path d="M12 14v2"/>',
    file: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5"/>',
    pdf: '<path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 17v-4h1.5a1.3 1.3 0 0 1 0 2.6H8m5 1.4v-4h1a2 2 0 0 1 0 4Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/>',
    retify: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M14 20h6"/>',
    team: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20v-1a6 6 0 0 1 12 0v1M14 20v-1a4 4 0 0 1 8 0v1"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    session: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-8 3v4m-2-2h4"/>',
    pts: '<path d="M12 3 4 7v6c0 4 3.5 7 8 8 4.5-1 8-4 8-8V7Z"/><path d="m9 12 2 2 4-4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    eyeClosed:
      '<path d="M3 12c2.5 2.5 5.5 3.75 9 3.75s6.5-1.25 9-3.75"/><path d="M7 14.5 5.5 17M12 15.75V18M17 14.5l1.5 2.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.4 2.4 0 0 1 4.8 0c0 2-2.4 2-2.4 4M12 16v1"/>',
    profile:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5a6.5 6.5 0 0 1 11 0"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
    filter: '<path d="M4 5h16l-6 8v6l-4-2v-4Z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h4"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  };

  function icon(name, cls = 'icon') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name] || glyphs.file}</svg>`;
  }

  const logo =
    '<span class="inline-flex items-center gap-3"><svg class="w-9 h-9" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M25 10C15 10 7 17 7 25C7 33 15 40 25 40C35 40 43 32 50 25C57 18 65 10 75 10C85 10 93 17 93 25C93 33 85 40 75 40C65 40 57 32 50 25C43 18 35 10 25 10Z" stroke="url(#logo-g)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="logo-g" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#D97706"/><stop offset="50%" stop-color="#2563EB"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs></svg><span class="flex flex-col"><span class="font-sans text-lg tracking-wider font-extrabold text-slate-900">TEA-PTS</span><span class="text-[10px] text-slate-500">Programa Terapêutico Singular</span></span></span>';

  const roles = {
    admin: { label: 'Administrador', user: 'Kaio Segunda Conta', short: 'Admin' },
    professional: { label: 'Profissional', user: 'Ana Souza', short: 'Profissional' },
    patient: { label: 'Paciente', user: 'Ana Clara Ribeiro', short: 'Paciente' },
    none: { label: 'Aguardando aprovação', user: 'Priscila Martins', short: 'Conta sem perfil' },
  };

  const decisions = {
    foto: {
      title: 'Foto',
      text: 'do paciente',
      options: [
        ['com', 'Com foto'],
        ['sem', 'Sem foto'],
      ],
    },
    cena: {
      title: 'Cenário',
      text: 'PTS do paciente',
      options: [
        ['sem', 'Sem PTS ativo'],
        ['com', 'Com PTS ativo'],
      ],
    },
    status: {
      title: 'Status',
      text: 'do PTS',
      options: [
        ['running', 'Em andamento'],
        ['planning', 'Em planejamento'],
      ],
    },
  };

  const body = document.body;
  const params = new URLSearchParams(location.search);
  const allowedRoles = (body.dataset.roles || 'admin,professional').split(',');
  const pageDps = (body.dataset.dps || '').split(',').filter(Boolean);

  const state = {
    role: allowedRoles.includes(params.get('role')) ? params.get('role') : allowedRoles[0],
  };
  Object.keys(decisions).forEach((key) => {
    const values = decisions[key].options.map(([value]) => value);
    state[key] = values.includes(params.get(key)) ? params.get(key) : values[0];
  });

  function navFor(role) {
    if (role === 'none') {
      return [['aguardando-perfil.html', 'home', 'Início']];
    }
    if (role === 'patient') {
      return [
        ['inicio-paciente.html', 'home', 'Início'],
        ['propostas-pts.html', 'clipboard', 'PTS'],
        ['meus-atendimentos.html', 'session', 'Atendimentos'],
        ['minhas-medicacoes.html', 'pill', 'Medicações'],
        ['meus-documentos.html', 'file', 'Documentos'],
      ];
    }
    const items = [
      ['inicio.html', 'home', 'Início'],
      ['profissionais.html', 'people', 'Profissionais'],
      ['lista-pts.html', 'clipboard', 'PTS'],
      ['pacientes.html', 'patient', 'Pacientes'],
      ['atendimentos.html', 'session', 'Atendimentos'],
    ];
    if (role === 'admin') {
      items.push(['contas.html', 'accounts', 'Contas']);
    }
    return items;
  }

  function initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  let collapsed = false;

  const navAlias = { 'propostas-pts.html': 'lista-pts.html', 'lista-pts.html': 'propostas-pts.html' };

  function renderShell() {
    const sidebar = document.getElementById('sidebar');
    const header = document.getElementById('app-header');
    if (!sidebar || !header) {
      return;
    }
    const current = (body.dataset.nav || '').split(' ');
    current.slice().forEach((href) => navAlias[href] && current.push(navAlias[href]));
    const role = roles[state.role];
    const items = navFor(state.role);
    const home = items[0][0];
    const toggleLabel = collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral';
    const onProfile = /meu-perfil(-editar)?\.html$/.test(location.pathname);
    document.querySelector('.shell-app')?.classList.toggle('shell-collapsed', collapsed);
    const crumbHome = document.querySelector('.shell-breadcrumb > a:first-child');
    if (crumbHome) {
      crumbHome.setAttribute('href', home);
    }
    sidebar.innerHTML = `<a href="${home}" class="shell-brand" aria-label="TEA-PTS, início">${logo}</a><button type="button" class="shell-edgeToggle" data-edge aria-label="${toggleLabel}" title="${toggleLabel}" aria-controls="sidebar" aria-expanded="${!collapsed}">${icon(collapsed ? 'chevronRight' : 'chevronLeft', 'shell-edgeIcon')}</button><button type="button" class="shell-iconButton shell-menuClose" data-menu="close" aria-label="Fechar navegação">${icon('close', 'shell-icon')}</button><nav class="shell-nav" aria-label="Menu principal">${items
      .map(
        ([href, ic, label]) =>
          `<a href="${href}" class="shell-navLink" ${current.includes(href) ? 'aria-current="page"' : ''} title="${label}">${icon(ic, 'shell-icon')}<span class="shell-navLabel">${label}</span></a>`,
      )
      .join('')}</nav><div class="shell-sideBottom"><div><a href="meu-perfil.html" class="shell-navLink" ${onProfile ? 'aria-current="page"' : ''} title="Meu perfil">${icon('profile', 'shell-icon')}<span class="shell-navLabel">Meu perfil</span></a><a href="teapts-login.html" class="shell-navLink" title="Sair da conta">${icon('logout', 'shell-icon')}<span class="shell-navLabel">Sair da conta</span></a></div></div>`;
    const unread = { professional: 2, patient: 1 }[state.role];
    const onBell = location.pathname.endsWith('notificacoes.html');
    const bell = unread !== undefined
      ? `<a href="notificacoes.html" class="ux-bell" ${onBell ? 'aria-current="page"' : ''} aria-label="Notificações: ${unread} não lida${unread === 1 ? '' : 's'}" title="Notificações">${icon('bell', 'shell-icon')}<span class="ux-bell-n" aria-hidden="true">${unread}</span></a>`
      : '';
    header.innerHTML = `<button type="button" class="shell-iconButton menu-open" data-menu="open" aria-label="Abrir navegação" title="Abrir navegação" aria-controls="sidebar">${icon('menu', 'shell-icon')}</button><div class="ux-header-end">${bell}<a href="meu-perfil.html" class="shell-headerProfile" ${onProfile ? 'aria-current="page"' : ''} aria-label="Meu perfil: ${role.user}, ${role.label}" title="Meu perfil"><span class="shell-avatar" aria-hidden="true">${initials(role.user)}</span><span class="shell-profileInfo"><strong>${role.user}</strong><small>${role.label}</small></span></a></div>`;
  }

  function renderMockbar() {
    const bar = document.querySelector('[data-mockbar]');
    if (!bar) {
      return;
    }
    if (allowedRoles.length < 2 && pageDps.length === 0) {
      bar.remove();
      return;
    }
    const roleGroup =
      allowedRoles.length > 1
        ? `<div class="mockbar-group"><span class="mockbar-label"><strong>Ver como</strong></span><div class="segmented" role="group" aria-label="Papel">${allowedRoles
            .map(
              (r) =>
                `<button type="button" data-set="role" data-value="${r}" aria-pressed="${state.role === r}">${roles[r].short}</button>`,
            )
            .join('')}</div></div>`
        : '';
    const dpGroups = pageDps
      .map((key) => {
        const dp = decisions[key];
        return `<div class="mockbar-group"><span class="mockbar-label"><strong>${dp.title}</strong> ${dp.text}</span><div class="segmented" role="group" aria-label="${dp.title}">${dp.options
          .map(
            ([value, label]) =>
              `<button type="button" data-set="${key}" data-value="${value}" aria-pressed="${state[key] === value}">${label}</button>`,
          )
          .join('')}</div></div>`;
      })
      .join('');
    bar.innerHTML = roleGroup + dpGroups;
  }

  function matches(expr) {
    return expr.split('|').some((alt) =>
      alt
        .trim()
        .split(/\s+/)
        .every((cond) => {
          const [key, values] = cond.split(':');
          return values.split(',').includes(state[key]);
        }),
    );
  }

  function applyWhen() {
    document.querySelectorAll('[data-when]').forEach((el) => {
      el.hidden = !matches(el.dataset.when);
    });
    document.querySelectorAll('[data-disabled-when]').forEach((el) => {
      el.disabled = matches(el.dataset.disabledWhen);
    });
  }

  function keepParams() {
    const query = new URLSearchParams();
    query.set('role', state.role);
    Object.keys(decisions).forEach((key) => {
      if (state[key] !== decisions[key].options[0][0]) {
        query.set(key, state[key]);
      }
    });
    try {
      history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
    } catch {
    }
    document.querySelectorAll('a[href]').forEach((a) => {
      const raw = a.getAttribute('href');
      const match = raw.match(/^([\w-]+\.html)(\?[^#]*)?(#.*)?$/);
      if (!match || raw.startsWith('teapts-login')) {
        return;
      }
      const own = new URLSearchParams(match[2] || '');
      query.forEach((value, key) => {
        if (key === 'role' && own.has('role')) {
          return;
        }
        own.set(key, value);
      });
      a.setAttribute('href', `${match[1]}?${own}${match[3] || ''}`);
    });
  }

  function refresh() {
    renderShell();
    renderMockbar();
    applyWhen();
    document.querySelectorAll('[data-filter-table]').forEach(filterTable);
    keepParams();
    syncTabs();
  }

  function filterCombo(input) {
    const list = document.getElementById(input.getAttribute('aria-controls'));
    const term = input.value.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const open = term.length >= 2;
    let shown = 0;
    list.querySelectorAll('[role="option"]').forEach((li) => {
      const q = li.dataset.q || '';
      const hit = open && (q.includes(term) || (digits.length >= 3 && q.includes(digits)));
      li.hidden = !hit;
      if (hit) shown += 1;
    });
    input.closest('[data-combo]').querySelector('.combo-empty').hidden = !open || shown > 0;
    list.hidden = !open || shown === 0;
    input.setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-combo] input');
    if (input) filterCombo(input);
  });
  document.addEventListener('click', (event) => {
    const opt = event.target.closest('[data-combo] [role="option"]');
    if (!opt) return;
    const combo = opt.closest('[data-combo]');
    const input = combo.querySelector('input');
    input.value = opt.dataset.value;
    combo.querySelectorAll('[role="option"]').forEach((li) => li.setAttribute('aria-selected', String(li === opt)));
    combo.querySelector('[role="listbox"]').hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.focus();
  });
  document.addEventListener('keydown', (event) => {
    const input = event.target.closest('[data-combo] input');
    if (input && event.key === 'Escape') {
      document.getElementById(input.getAttribute('aria-controls')).hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }
  });

  function filterTable(table) {
    const id = table.id;
    const box = document.querySelector(`[data-filters="${id}"]`);
    const rows = [...table.tBodies[0].rows].filter(
      (tr) =>
        !tr.hasAttribute('data-empty') &&
        !tr.classList.contains('group-row') &&
        !tr.classList.contains('ux-detail'),
    );
    const criteria = [];
    if (box) {
      const search = box.querySelector('[data-search]');
      const term = search ? search.value.trim().toLowerCase() : '';
      if (term) {
        criteria.push((tr) => (tr.dataset.q || tr.textContent).toLowerCase().includes(term));
      }
      box.querySelectorAll('.multi[data-key]').forEach((multi) => {
        const checked = [...multi.querySelectorAll('input:checked')].map((i) => i.value);
        const value = multi.querySelector('.multi-value');
        value.textContent = checked.length
          ? checked.length === 1
            ? multi.querySelector('input:checked').parentElement.textContent.trim()
            : `${checked.length} selecionados`
          : multi.dataset.placeholder || 'Todos';
        value.classList.toggle('is-set', checked.length > 0);
        if (checked.length) {
          criteria.push((tr) =>
            (tr.dataset[multi.dataset.key] || '').split(' ').some((v) => checked.includes(v)),
          );
        }
      });
      box.querySelectorAll('select[data-key]').forEach((select) => {
        if (select.value && select.value !== 'custom') {
          criteria.push((tr) =>
            (tr.dataset[select.dataset.key] || '').split(' ').includes(select.value),
          );
        }
      });
      box.querySelectorAll('input[type="checkbox"][data-key]').forEach((check) => {
        if (check.checked && !check.closest('[hidden]')) {
          criteria.push((tr) => (tr.dataset[check.dataset.key] || '').split(' ').includes(check.value));
        }
      });
      box.querySelectorAll('.chip-filter[data-key]').forEach((chips) => {
        const active = chips.querySelector('[aria-pressed="true"]');
        if (active && active.dataset.value) {
          criteria.push((tr) =>
            (tr.dataset[chips.dataset.key] || '').split(' ').includes(active.dataset.value),
          );
        }
      });
    }
    let visible = 0;
    rows.forEach((tr) => {
      const roleOk = !tr.dataset.when || matches(tr.dataset.when);
      const show = roleOk && criteria.every((fn) => fn(tr));
      tr.hidden = !show;
      if (show) {
        visible += 1;
      }
    });
    syncDetails(table);
    [...table.tBodies[0].rows]
      .filter((tr) => tr.classList.contains('group-row'))
      .forEach((group) => {
        let next = group.nextElementSibling;
        let any = false;
        while (next && !next.classList.contains('group-row')) {
          if (!next.hidden && !next.hasAttribute('data-empty')) {
            any = true;
          }
          next = next.nextElementSibling;
        }
        group.hidden = !any || (group.dataset.when && !matches(group.dataset.when));
      });
    const empty = table.querySelector('tr[data-empty]');
    if (empty) {
      empty.hidden = visible > 0;
    }
    document.querySelectorAll(`[data-count-for="${id}"]`).forEach((el) => {
      const total = el.dataset[`total${state.role[0].toUpperCase()}${state.role.slice(1)}`] || el.dataset.total;
      const filtered = criteria.length > 0 && Boolean(total);
      const count = total && !criteria.length ? Number(total) : visible;
      const word = count === 1 ? el.dataset.singular : el.dataset.plural;
      el.textContent = filtered ? `${count} ${word} com os filtros atuais` : `${count} ${word}`;
    });
  }

  function syncResults() {
    document.querySelectorAll('[data-results]').forEach((box) => {
      const groups = {};
      box.querySelectorAll('input[data-result]').forEach((r) => {
        groups[r.name] = groups[r.name] || null;
        if (r.checked) {
          groups[r.name] = r.value;
        }
      });
      const values = Object.values(groups);
      const count = (v) => values.filter((x) => x === v).length;
      box.querySelectorAll('[data-result-count]').forEach((el) => {
        const key = el.dataset.resultCount;
        el.textContent = String(key === 'none' ? count(null) : count(key));
      });
      const missing = count(null);
      const msg = box.querySelector('[data-result-missing]');
      if (msg) {
        msg.textContent = missing
          ? `Falta${missing > 1 ? 'm' : ''} ${missing} meta${missing > 1 ? 's' : ''} sem resultado para avançar.`
          : 'Todas as metas têm resultado.';
        msg.classList.toggle('is-ok', !missing);
      }
      const next = box.querySelector('[data-result-next]');
      if (next) {
        next.disabled = missing > 0;
      }
    });
  }

  function syncDetails(table) {
    table.querySelectorAll('tr.ux-detail').forEach((detail) => {
      const main = detail.previousElementSibling;
      const button = main.querySelector('[data-expand]');
      const open = button.getAttribute('aria-expanded') === 'true';
      detail.hidden = main.hidden || !open;
      main.classList.toggle('ux-open', open && !main.hidden);
    });
  }

  let openMenu = null;

  function closeMenu() {
    if (!openMenu) {
      return;
    }
    openMenu.menu.hidden = true;
    openMenu.button.setAttribute('aria-expanded', 'false');
    openMenu = null;
  }

  function toggleMenu(button) {
    const menu = button.nextElementSibling;
    if (openMenu && openMenu.button === button) {
      closeMenu();
      return;
    }
    closeMenu();
    menu.hidden = false;
    const rect = button.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const top =
      rect.bottom + height + 8 > innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(8, rect.right - width)}px`;
    button.setAttribute('aria-expanded', 'true');
    openMenu = { button, menu };
    const first = [...menu.querySelectorAll('button, a')].find((b) => !b.closest('[hidden]'));
    if (first) {
      first.focus();
    }
  }

  function toast(message) {
    let el = document.getElementById('mock-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mock-toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.append(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function confirmDialog(spec) {
    const [title, text, label, tone] = spec.split('|');
    const danger = tone ? tone === 'danger' : /^(Excluir|Desativar|Remover|Rejeitar|Suspender|Arquivar|Encerrar)/.test(label);
    let dialog = document.getElementById('mock-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'mock-dialog';
      dialog.className = 'dialog';
      dialog.setAttribute('aria-labelledby', 'mock-dialog-title');
      document.body.append(dialog);
    }
    dialog.innerHTML = `<h2 id="mock-dialog-title">${title}</h2><p>${text}</p><div class="dialog-actions"><button type="button" class="btn" data-dialog="cancel">Cancelar</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-dialog="ok">${label}</button></div>`;
    dialog.showModal();
    dialog.querySelector('[data-dialog="cancel"]').focus();
    dialog.onclick = (event) => {
      const action = event.target.closest('[data-dialog]');
      if (!action) {
        return;
      }
      dialog.close();
      if (action.dataset.dialog === 'ok') {
        toast(`${label}: feito (simulação).`);
      }
    };
  }

  function syncTabs() {
    document.querySelectorAll('[data-tabs]').forEach((nav) => {
      const links = [...nav.querySelectorAll('a[href^="#"]')].filter((a) => !a.hidden);
      if (!links.length) {
        return;
      }
      const ids = links.map((a) => a.getAttribute('href').split('#')[1]);
      const hash = location.hash.slice(1);
      const active = ids.includes(hash) ? hash : nav.dataset.default || ids[0];
      links.forEach((a) => {
        const id = a.getAttribute('href').split('#')[1];
        if (id === active) {
          a.setAttribute('aria-current', 'page');
        } else {
          a.removeAttribute('aria-current');
        }
      });
      document.querySelectorAll('[data-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== active || (panel.dataset.when ? !matches(panel.dataset.when) : false);
      });
    });
  }

  let tip = null;

  function showTip(target) {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tip';
      tip.setAttribute('role', 'tooltip');
      document.body.append(tip);
    }
    tip.innerHTML = target.dataset.tip;
    tip.hidden = false;
    const rect = target.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, rect.left))}px`;
    tip.style.top = `${Math.max(8, rect.top - tip.offsetHeight - 8)}px`;
  }

  function hideTip() {
    if (tip) {
      tip.hidden = true;
    }
  }

  document.addEventListener('click', (event) => {
    const tip = event.target.closest('.tip-trigger');
    document.querySelectorAll('.tip-wrapper[data-open]').forEach((w) => w !== tip?.parentElement && w.removeAttribute('data-open'));
    if (tip) {
      tip.parentElement.toggleAttribute('data-open');
      tip.setAttribute('aria-expanded', String(tip.parentElement.hasAttribute('data-open')));
      return;
    }
    const set = event.target.closest('[data-set]');
    if (set) {
      state[set.dataset.set] = set.dataset.value;
      refresh();
      return;
    }
    const kebab = event.target.closest('.kebab-btn');
    if (kebab) {
      toggleMenu(kebab);
      return;
    }
    const menuButton = event.target.closest('.kebab-menu button, .kebab-menu a');
    if (menuButton) {
      closeMenu();
      if (menuButton.tagName === 'A') {
        return;
      }
    } else if (openMenu && !event.target.closest('.kebab-menu')) {
      closeMenu();
    }
    const opener = event.target.closest('[data-open]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.open);
      if (!opener.closest('dialog')) {
        document.querySelectorAll('dialog[open]').forEach((d) => d !== dialog && d.close());
      }
      applyWhen();
      syncTabs();
      dialog.showModal();
      return;
    }
    const closer = event.target.closest('[data-close]');
    if (closer) {
      closer.closest('dialog').close();
      return;
    }
    if (
      event.target.tagName === 'DIALOG' &&
      (event.target.classList.contains('modal') || event.target.classList.contains('dialog-front'))
    ) {
      event.target.close();
      return;
    }
    const confirmTarget = event.target.closest('[data-confirm]');
    if (confirmTarget) {
      confirmDialog(confirmTarget.dataset.confirm);
      return;
    }
    const swap = event.target.closest('[data-show]');
    if (swap) {
      swap.dataset.show.split(' ').forEach((id) => (document.getElementById(id).hidden = false));
      (swap.dataset.hide || '').split(' ').filter(Boolean).forEach((id) => (document.getElementById(id).hidden = true));
      return;
    }
    const reveal = event.target.closest('[data-reveal]');
    if (reveal) {
      const input = document.getElementById(reveal.dataset.reveal);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(show));
      reveal.innerHTML = icon(show ? 'eye' : 'eyeClosed');
      return;
    }
    const expand = event.target.closest('[data-expand]');
    if (expand) {
      const open = expand.getAttribute('aria-expanded') !== 'true';
      expand.setAttribute('aria-expanded', String(open));
      expand.setAttribute('aria-label', open ? 'Ocultar detalhes' : 'Mostrar detalhes');
      syncDetails(expand.closest('table'));
      return;
    }
    const filterToggle = event.target.closest('[data-filter-toggle]');
    if (filterToggle) {
      const more = filterToggle.closest('[data-filters]').querySelector('.filter-more');
      const open = more.hidden;
      more.hidden = !open;
      filterToggle.setAttribute('aria-expanded', String(open));
      return;
    }
    const copyTarget = event.target.closest('[data-copy]');
    if (copyTarget && navigator.clipboard) {
      navigator.clipboard.writeText(copyTarget.dataset.copy).catch(() => {});
    }
    const toastTarget = event.target.closest('[data-toast]');
    if (toastTarget) {
      toast(toastTarget.dataset.toast);
      return;
    }
    if (menuButton) {
      toast(`${menuButton.textContent.trim()} (simulação).`);
      return;
    }
    if (event.target.closest('[data-edge]')) {
      collapsed = !collapsed;
      renderShell();
      keepParams();
      return;
    }
    const menu = event.target.closest('[data-menu]');
    if (menu) {
      document.getElementById('sidebar').classList.toggle('shell-open', menu.dataset.menu === 'open');
      return;
    }
    const chip = event.target.closest('.chip-filter button');
    if (chip) {
      chip.parentElement
        .querySelectorAll('button')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
      document.querySelectorAll('[data-filter-table]').forEach(filterTable);
      return;
    }
    const dir = event.target.closest('.sort-dir');
    if (dir) {
      const asc = dir.dataset.dir !== 'asc';
      dir.dataset.dir = asc ? 'asc' : 'desc';
      dir.setAttribute('aria-label', asc ? 'Ordem crescente' : 'Ordem decrescente');
      dir.innerHTML = icon(asc ? 'sortUp' : 'sortDown', 'icon-sm');
      return;
    }
    const clear = event.target.closest('[data-clear]');
    if (clear) {
      const box = clear.closest('[data-filters]') || document.querySelector(`[data-filters="${clear.dataset.clear}"]`);
      box.querySelectorAll('input[type="search"], input[type="text"]').forEach((i) => (i.value = ''));
      box.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = i.defaultChecked));
      box.querySelectorAll('select').forEach((s) => {
        s.selectedIndex = 0;
        s.dispatchEvent(new Event('change', { bubbles: true }));
      });
      document.querySelectorAll('[data-filter-table]').forEach(filterTable);
      return;
    }
    if (!event.target.closest('.multi')) {
      document.querySelectorAll('.multi[open]').forEach((d) => d.removeAttribute('open'));
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-saved]');
    if (form) {
      event.preventDefault();
      form.closest('dialog')?.close();
      if (form.matches('[data-require-all]')) {
        form.reset();
        syncRequireAll(form);
      }
      toast(form.dataset.saved);
    }
  });

  function syncRequirements(input) {
    const box = document.getElementById(input.dataset.requirements);
    const value = input.value;
    const rules = { length: value.length >= 8, number: /\d/.test(value) };
    box.querySelectorAll('[data-rule]').forEach((li) => {
      const ok = rules[li.dataset.rule];
      li.classList.toggle('is-met', ok);
      li.classList.toggle('is-missing', !ok && value.length > 0);
      li.querySelector('span').textContent = ok ? '✓' : '•';
    });
  }

  function syncRequireAll(form) {
    const filled = [...form.querySelectorAll('[required]')].every((f) => f.value.trim() !== '');
    form.querySelectorAll('button[type="submit"]').forEach((b) => { b.disabled = !filled; });
  }
  document.querySelectorAll('form[data-require-all]').forEach(syncRequireAll);

  document.addEventListener('input', (event) => {
    const password = event.target.closest('input[data-requirements]');
    if (password) {
      syncRequirements(password);
    }
    const requireAll = event.target.closest('form[data-require-all]');
    if (requireAll) {
      syncRequireAll(requireAll);
    }
    if (event.target.closest('[data-filters]')) {
      document.querySelectorAll('[data-filter-table]').forEach(filterTable);
    }
  });

  function syncStatusDates(select) {
    const scope = select.closest('form') || document;
    scope.querySelectorAll('[data-status-show]').forEach((el) => {
      if (el.dataset.statusFor ? el.dataset.statusFor !== select.id : select.dataset.statusOwn !== undefined) {
        return;
      }
      el.hidden = !el.dataset.statusShow.split(',').includes(select.value);
    });
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-term-toggle]');
    if (!toggle) {
      return;
    }
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.closest('tbody').querySelectorAll(`tr[data-term-group="${toggle.dataset.termToggle}"]`).forEach((tr) => {
      tr.classList.toggle('is-collapsed', !open);
    });
  });

  function syncReveal(group) {
    const checked = document.querySelector(`input[data-reveal="${group}"]:checked`);
    document.querySelectorAll(`[data-reveal-for="${group}"]`).forEach((el) => {
      el.hidden = !checked || el.dataset.revealValue !== checked.value;
    });
  }

  document.addEventListener('change', (event) => {
    const radio = event.target.closest('input[data-reveal]');
    if (radio) {
      syncReveal(radio.dataset.reveal);
    }
  });
  new Set([...document.querySelectorAll('input[data-reveal]')].map((r) => r.dataset.reveal)).forEach(syncReveal);

  document.addEventListener('change', (event) => {
    const none = event.target.closest('input[data-none-for]');
    if (none) {
      const text = document.getElementById(none.dataset.noneFor);
      text.disabled = none.checked;
      if (none.checked) {
        text.value = '';
      }
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.matches('input[data-result]')) {
      syncResults();
    }
    const statusSelect = event.target.closest('select[data-status-select]');
    if (statusSelect) {
      syncStatusDates(statusSelect);
    }
    const council = event.target.closest('select[data-council-target]');
    if (council) {
      document.getElementById(council.dataset.councilTarget).value =
        council.selectedOptions[0].dataset.council || '';
      if (council.dataset.regKeep) {
        const changed = (council.selectedOptions[0].dataset.council || '') !== council.dataset.councilOriginal;
        document.getElementById(council.dataset.regKeep).hidden = changed;
        const fresh = document.getElementById(council.dataset.regNew);
        fresh.hidden = !changed;
        fresh.querySelectorAll('input, select').forEach((f) => {
          f.required = changed;
          if (!changed) f.value = '';
        });
      }
    }
    const range = event.target.closest('select[data-range]');
    if (range) {
      const custom = range.parentElement.querySelector('.range-custom');
      if (custom) {
        custom.hidden = range.value !== 'custom';
      }
    }
    if (event.target.closest('[data-filters]')) {
      document.querySelectorAll('[data-filter-table]').forEach(filterTable);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      hideTip();
      document.querySelectorAll('.multi[open]').forEach((d) => d.removeAttribute('open'));
      document.getElementById('sidebar')?.classList.remove('shell-open');
    }
  });

  document.addEventListener('mouseover', (event) => {
    const target = event.target.closest('[data-tip]');
    if (target) {
      showTip(target);
    }
  });
  document.addEventListener('mouseout', (event) => {
    if (event.target.closest('[data-tip]')) {
      hideTip();
    }
  });
  document.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-tip]');
    if (target) {
      showTip(target);
    } else {
      hideTip();
    }
  });
  addEventListener('scroll', () => {
    closeMenu();
    hideTip();
  }, true);
  addEventListener('resize', closeMenu);
  addEventListener('hashchange', syncTabs);

  document.querySelectorAll('i[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, el.className || 'icon-sm');
  });
  document.querySelectorAll('.kebab-btn').forEach((b) => {
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.classList.add('icon-button');
    if (!b.innerHTML.trim()) {
      b.innerHTML = icon('more');
    }
  });
  document.querySelectorAll('.sort-dir').forEach((b) => {
    b.innerHTML = icon(b.dataset.dir === 'asc' ? 'sortUp' : 'sortDown', 'icon-sm');
  });
  document.querySelectorAll('[data-reveal]').forEach((b) => {
    b.innerHTML = icon('eyeClosed');
  });
  document.querySelectorAll('[data-if-param]').forEach((el) => {
    el.hidden = !params.has(el.dataset.ifParam);
  });

  refresh();
  syncTabs();
  document.querySelectorAll('select[data-param]').forEach((select) => {
    const value = params.get(select.dataset.param);
    if (value !== null && [...select.options].some((o) => o.value === value)) {
      select.value = value;
    }
  });
  document.querySelectorAll('select[data-status-select]').forEach(syncStatusDates);
  document.querySelectorAll('dialog[data-autoopen]').forEach((d) => d.showModal());
  syncResults();
})();
