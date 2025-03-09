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
        
        blogGrid.innerHTML = ''; // Limpiar el contenido existente
        
        if (items.length === 0) {
            throw new Error('No se encontraron entradas en el feed');
        }
        
        items.forEach((item, index) => {
            if (index >= 3) return; // Solo mostrar los 3 primeros posts
            
            const title = item.querySelector('title')?.textContent || 'Sin título';
            const link = item.querySelector('link')?.textContent || '#';
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = new Date(item.querySelector('pubDate')?.textContent || new Date());
            
            // Extraer la imagen si existe
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = description;
            const image = tempDiv.querySelector('img')?.src;
            
            // Limpiar el texto de la descripción
            const textDescription = description
                .replace(/<[^>]*>/g, '') // Eliminar tags HTML
                .replace(/\s+/g, ' ') // Normalizar espacios
                .trim();
            
            const article = document.createElement('article');
            article.className = 'blog-card';
            
            article.innerHTML = `
                ${image ? `
                <div class="blog-card-image">
                    <img src="${image}" alt="${title}">
                </div>
                ` : ''}
                <div class="blog-card-content">
                    <h2><a href="${link}" target="_blank">${title}</a></h2>
                    <div class="post-meta">
                        <span class="post-date">${pubDate.toLocaleDateString('es-ES')}</span>
                        <span class="category">Telegram</span>
                    </div>
                    <p class="post-excerpt">${textDescription.slice(0, 150)}...</p>
                    <a href="${link}" target="_blank" class="read-more">Leer más</a>
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

// Cargar el feed cuando el documento esté listo
document.addEventListener('DOMContentLoaded', loadTelegramFeed);
