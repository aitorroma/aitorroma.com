async function loadTelegramFeed() {
    const feedUrl = 'https://rsshub.aitorroma.com/telegram/channel/aitorroma';
    const corsProxy = 'https://api.allorigins.win/raw?url=';
    const apiUrl = corsProxy + encodeURIComponent(feedUrl);
    
    try {
        const response = await fetch(apiUrl);
        const data = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(data, 'application/xml');
        const items = xml.querySelectorAll('item');
        const blogGrid = document.querySelector('.blog-grid');
        
        blogGrid.innerHTML = '';
        
        if (items.length === 0) {
            throw new Error('No se encontraron entradas en el feed');
        }
        
        items.forEach((item, index) => {
            if (index >= 3) return;
            
            const description = item.querySelector('description')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '#';
            const pubDate = new Date(item.querySelector('pubDate')?.textContent || new Date());
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            
            const firstParagraph = tempDiv.querySelector('p');
            if (!firstParagraph) return;
            
            const paragraphContent = firstParagraph.innerHTML;
            const parts = paragraphContent.split('<br><br>');
            
            const titlePart = parts[0].split('<br>')[0];
            const title = titlePart.replace(/<[^>]*>/g, '').trim();
            
            let textDescription = '';
            if (parts.length > 1) {
                textDescription = parts.slice(1)
                    .join(' ')
                    .replace(/<br>/g, ' ')
                    .replace(/<[^>]*>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            
            const hashtags = [];
            const links = [];
            tempDiv.querySelectorAll('a').forEach(a => {
                if (a.textContent.startsWith('#')) {
                    hashtags.push(a.outerHTML);
                } else if (a.textContent.startsWith('@')) {
                    links.push(a.outerHTML);
                }
            });
            
            const image = tempDiv.querySelector('blockquote img')?.src;
            
            const article = document.createElement('article');
            article.className = 'blog-card';
            
            article.innerHTML = `
                ${image ? `
                <div class="blog-card-image">
                    <img src="${image}" alt="${title}" loading="lazy">
                </div>
                ` : ''}
                <div class="blog-card-content">
                    <h2><a href="${link}" target="_blank">${title}</a></h2>
                    <div class="post-meta">
                        <span class="post-date">${pubDate.toLocaleDateString('es-ES')}</span>
                    </div>
                    <p class="post-excerpt">${textDescription}</p>
                    ${hashtags.length > 0 || links.length > 0 ? `
                    <div class="post-tags">
                        ${hashtags.join(' ')}
                        ${links.join(' ')}
                    </div>
                    ` : ''}
                    <a href="${link}" target="_blank" class="read-more">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.3 12.3a.7.7 0 0 1 0 1l-1.5 1.5a.7.7 0 0 1-1 0l-1.5-1.5M3 8h13.6a2 2 0 0 1 2 2v6.7"></path>
                        </svg>
                        Ver en Telegram
                    </a>
                </div>
            `;
            
            blogGrid.appendChild(article);
        });
    } catch (error) {
        console.error('Error al cargar el feed de Telegram:', error);
        document.querySelector('.blog-grid').innerHTML = `
            <div class="error-message">
                No se pudieron cargar las entradas del canal de Telegram.
                <br>
                Por favor, intenta más tarde.
                <br>
                Error: ${error.message}
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', loadTelegramFeed);
