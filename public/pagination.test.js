const { updateQueryStringParameter, showPageLinks, showResultCount } = require('./pagination');

describe('updateQueryStringParameter', () => {
  it('adds a query parameter when missing', () => {
    const updated = updateQueryStringParameter('https://example.com/search', 'start', 20);
    expect(updated).toBe('https://example.com/search?start=20');
  });

  it('replaces an existing query parameter', () => {
    const updated = updateQueryStringParameter('https://example.com/search?start=10&q=test', 'start', 30);
    expect(updated).toBe('https://example.com/search?start=30&q=test');
  });
});

describe('showPageLinks', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="pages"></div>';
  });

  it('renders page links with an active page', () => {
    showPageLinks(50, 10, 3, 10, 'pages');
    const html = document.getElementById('pages').innerHTML;
    expect(html).toContain('class="active"');
    expect(html).toContain('start=0');
    expect(html).toContain('«');
    expect(html).toContain('»');
  });
});

describe('showResultCount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="resultCount"></div>';
  });

  it('escapes query text and renders count', () => {
    showResultCount('<script>', 2, 10, 0, 'resultCount');
    const html = document.getElementById('resultCount').innerHTML;
    expect(html).toContain('Found 2 results');
    expect(html).toContain('&lt;script&gt;');
  });
});
