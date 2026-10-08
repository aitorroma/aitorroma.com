---
layout: default
title: Servicios · Aitor Roma
description: Desarrollo a medida, microservicios en Go (Golang), comercio electrónico con WooCommerce y PrestaShop, automatización e infraestructura.
permalink: /servicios/
stylesheets:
  - /assets/css/services-document.css
---
<div class="services-page">
  <div class="services-page-links"><a href="{{ '/' | relative_url }}#servicios">← Volver al documento en aitorOS</a><a href="{{ '/assets/documents/servicios.rtf' | relative_url }}" download>Descargar original · RTF ↓</a></div>
  <article class="document-paper">
    <div class="document-letterhead">AITOR ROMA <span>Servicios · Desarrollo y tecnología</span></div>
    <div class="services-content">
      {% capture services_markdown %}{% include servicios.md %}{% endcapture %}
      {{ services_markdown | markdownify }}
    </div>
    {% include services-contact.html %}
  </article>
</div>
