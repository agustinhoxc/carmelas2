/* providers.js — client-side provider data: loading, normalising, rendering.
   Static HTML pages are generated at build time; this module only powers
   the interactive search, which cannot be pre-rendered. */
(function (global) {
  'use strict';

  var NS = (global.Nearsite = global.Nearsite || {});
  var cache = null;

  function basePath() {
    var el = document.documentElement;
    return el.getAttribute('data-base') || '';
  }

  function normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function load() {
    if (cache) return Promise.resolve(cache);
    var base = basePath();
    return Promise.all([
      fetch(base + '/data/providers.json').then(function (r) { return r.json(); }),
      fetch(base + '/data/categories.json').then(function (r) { return r.json(); }),
      fetch(base + '/data/locations.json').then(function (r) { return r.json(); }),
      fetch(base + '/data/tags.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      cache = index(res[0], res[1], res[2], res[3]);
      return cache;
    });
  }

  function index(providers, categories, locations, tags) {
    var categoryBySlug = {};
    categories.forEach(function (c) { categoryBySlug[c.slug] = c; });

    var cityBySlug = {};
    locations.forEach(function (state) {
      (state.cities || []).forEach(function (city) {
        cityBySlug[city.slug] = { city: city, state: state };
      });
    });

    var tagBySlug = {};
    tags.forEach(function (t) { tagBySlug[t.slug] = t; });

    var active = providers.filter(function (p) { return p.active !== false; });

    active.forEach(function (p) {
      var category = categoryBySlug[p.category];
      var sub = category && (category.subcategories || []).filter(function (s) {
        return s.slug === p.subcategory;
      })[0];
      var place = cityBySlug[p.city];

      p._categoryName = category ? category.name : p.category;
      p._subcategoryName = sub ? sub.name : '';
      p._cityName = place ? place.city.name : p.city;
      p._stateName = place ? place.state.name : p.state;
      p._stateSlug = place ? place.state.slug : '';
      p._url = basePath() + '/providers/' + p.slug + '/';
      p._tagNames = (p.tags || []).map(function (slug) {
        return tagBySlug[slug] ? tagBySlug[slug].name : slug.replace(/-/g, ' ');
      });
      p._haystack = normalize([
        p.name, p.tagline, p.shortDescription, p._categoryName, p._subcategoryName,
        p._cityName, p._stateName, p.state, (p.areasServed || []).join(' '),
        (p.services || []).map(function (s) { return s.name; }).join(' '),
        p._tagNames.join(' '), (p.tags || []).join(' ')
      ].join(' '));
    });

    return {
      providers: active,
      categories: categories,
      locations: locations,
      tags: tags,
      categoryBySlug: categoryBySlug,
      cityBySlug: cityBySlug,
      tagBySlug: tagBySlug
    };
  }

  function score(provider, terms) {
    if (!terms.length) return 1;
    var name = normalize(provider.name);
    var hit = 0;
    for (var i = 0; i < terms.length; i++) {
      if (provider._haystack.indexOf(terms[i]) === -1) return 0;
      hit += name.indexOf(terms[i]) !== -1 ? 3 : 1;
    }
    if (provider.featured) hit += 0.5;
    return hit;
  }

  function search(data, query) {
    var terms = normalize(query.text).split(' ').filter(Boolean);
    return data.providers
      .map(function (p) { return { p: p, s: score(p, terms) }; })
      .filter(function (r) {
        if (!r.s) return false;
        var p = r.p;
        if (query.category && p.category !== query.category) return false;
        if (query.city && p.city !== query.city) return false;
        if (query.state && p.state !== query.state) return false;
        if (query.tags && query.tags.length) {
          for (var i = 0; i < query.tags.length; i++) {
            if ((p.tags || []).indexOf(query.tags[i]) === -1) return false;
          }
        }
        return true;
      })
      .sort(function (a, b) {
        if (b.s !== a.s) return b.s - a.s;
        return a.p.name.localeCompare(b.p.name);
      })
      .map(function (r) { return r.p; });
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cardHtml(p, ctx) {
    var base = basePath();
    var assets = base + '/assets/providers/' + esc(p.slug) + '/';
    var marks = '';
    if (p.demo) marks += '<span class="badge badge-demo">Demo listing</span>';
    if (p.featured) marks += '<span class="badge badge-featured">Featured</span>';
    if (p.sponsored) marks += '<span class="badge badge-sponsored">Sponsored</span>';
    if (p.verified) marks += '<span class="badge badge-verified">Verified</span>';

    var tags = (p.tags || []).slice(0, 3).map(function (slug, i) {
      return '<li><a class="tag" href="' + base + '/tags/' + esc(slug) + '/">' + esc(p._tagNames[i]) + '</a></li>';
    }).join('');

    var wa = NS.whatsapp.link({
      whatsapp: p.whatsapp,
      provider: p.name,
      subject: p._categoryName ? p._categoryName.toLowerCase() : '',
      portal: (ctx && ctx.portal) || 'Nearsite'
    });

    return '' +
      '<li class="p-card">' +
        '<a class="p-card-media" href="' + p._url + '" tabindex="-1" aria-hidden="true">' +
          '<img src="' + assets + esc(p.heroImage || 'hero.svg') + '" alt="" width="480" height="300" loading="lazy" decoding="async">' +
          (marks ? '<span class="p-card-marks">' + marks + '</span>' : '') +
        '</a>' +
        '<div class="p-card-body">' +
          '<span class="p-card-logo"><img src="' + assets + esc(p.logo || 'logo.svg') + '" alt="' + esc(p.name) + ' logo" width="56" height="56" loading="lazy"></span>' +
          '<h3><a href="' + p._url + '">' + esc(p.name) + '</a></h3>' +
          '<p class="p-card-meta">' + esc(p._categoryName) + ' in ' + esc(p._cityName) + ', ' + esc(p.state) + '</p>' +
          '<p class="p-card-desc">' + esc(p.shortDescription) + '</p>' +
          (tags ? '<ul class="tag-list">' + tags + '</ul>' : '') +
        '</div>' +
        '<div class="p-card-foot">' +
          '<a class="btn btn-ghost btn-sm" href="' + p._url + '">View page</a>' +
          (wa ? '<a class="btn btn-whatsapp btn-sm" data-track="click_whatsapp" data-provider="' + esc(p.slug) + '" href="' + wa + '" rel="nofollow noopener" target="_blank">WhatsApp</a>' : '') +
        '</div>' +
      '</li>';
  }

  NS.providers = {
    load: load, search: search, normalize: normalize, cardHtml: cardHtml, esc: esc, basePath: basePath
  };
})(window);
