---
layout: project
title: G33K TEAM - Tecnología desde las trincheras
description: Un grupo de profesionales compartiendo experiencias y conocimientos técnicos en formato videopodcast
---

<div class="project-header">
  <img src="/assets/images/projects/g33k-team-logo.jpg" alt="G33K TEAM Logo" class="project-logo">
</div>

<div class="project-content">
  <h1>G33K TEAM - Tecnología desde las trincheras</h1>

  <h3>¿Qué es G33K TEAM?</h3>

  <p>G33K TEAM es un grupo de profesionales con habilidades y especialidades diversas en tecnología, que se han unido para compartir sus experiencias, conocimientos y perspectiva geek sobre el mundo de la tecnología. El equipo está formado por personas con una amplia experiencia en áreas como infraestructura, marketing técnico, inteligencia artificial, automatización, programación y hardware.</p>

  <h3>Objetivo</h3>

  <p>El objetivo del grupo es salir de sus "batcuevas" y exponer sus conocimientos de una manera más visible, a través de un videopodcast donde se hablará sin restricciones de lo que más les apasiona, con un enfoque realista y sin adornos, desde el trabajo en las trincheras hasta anécdotas y conocimientos técnicos profundos.</p>

  <h2>Episodios</h2>

  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/plyr@3/dist/plyr.css">
  <div class="playlist-player plyr__video-embed" id="g33k-player">
    <iframe src="https://www.youtube.com/embed/videoseries?list=PLKTQO0qHrl1Vb-slf0rdptzw0gCHme-2k&amp;rel=0&amp;modestbranding=1&amp;iv_load_policy=3" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" title="G33K TEAM Playlist"></iframe>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/plyr@3/dist/plyr.polyfilled.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      const player = new Plyr('#g33k-player', {
        youtube: { rel: 0, modestbranding: 1 },
        controls: [
          'play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
        ]
      });
    });
  </script>

  <h2>¡Únete a la comunidad!</h2>
  
  <div class="topgit-cta">
    <a href="https://www.youtube.com/@G33KTEAM?sub_confirmation=1" class="cta-button youtube" target="_blank">
      <span class="icon"></span>
      Suscríbete al canal
    </a>
  </div>
</div>
