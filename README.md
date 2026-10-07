# aitorOS

Portafolio interactivo de Aitor Roma con estética de escritorio Linux, construido con Jekyll.

## Contenido

- Añade artículos en `_posts/` con el formato `AAAA-MM-DD-slug.md`.
- Añade proyectos en `projects/` usando `layout: project` en el front matter.
- Edita los repositorios destacados en `_data/repositories.yml`.

La portada descubre automáticamente los Markdown de artículos y proyectos; no hay que editar `index.html` al publicar contenido nuevo.

## Desarrollo local

```bash
bundle install
bundle exec jekyll serve
```

Después abre `http://localhost:4000`.

## Sincronizar currículum

`curriculum.html` es la referencia para experiencia y competencias. Después de modificarlo ejecuta `python3 scripts/sync-curriculum.py` y reconstruye Jekyll. El script genera `_data/curriculum.json`, utilizado por las ventanas Experiencia y Stack.

## Vista simple

`/simple/` conserva la portada original del repositorio con su layout, estilos e imágenes. El botón Vista simple de aitorOS y `/#simple` abren esta página.
