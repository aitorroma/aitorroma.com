---
layout: post
title: "Kopia: La Herramienta Moderna para Copias de Seguridad"
description: "Descubre cómo utilizar Kopia, una herramienta libre y moderna para realizar copias de seguridad de forma eficiente y segura."
date: 2025-03-09
author: Aitor Roma
category: infrastructure
image: /assets/images/blog/kopia-backup.jpeg
reading_time: 15
tags: [backup, seguridad, infraestructura, open-source]
---

# Kopia: La Herramienta Moderna para Copias de Seguridad

Kopia es una herramienta libre, moderna y rápida para hacer copias de seguridad. Al igual que otras herramientas como Borg o Restic, Kopia permite tomar snapshots de los datos del usuario y guardarlos en un repositorio.

## Tipos de repositorio

Kopia ofrece diferentes tipos de repositorio para almacenar las copias de seguridad:

- Directorio local
- Servidor SFTP o WebDAV
- Proveedores de almacenamiento en la nube
- Servicios soportados por Rclone

La herramienta almacena los backups de manera eficiente utilizando técnicas de deduplicación y compresión opcionales. Además, ofrece seguridad mediante cifrado y proporciona una interfaz sencilla tanto en la línea de comandos como en una interfaz gráfica.

Cuando se necesita recuperar datos de una copia de seguridad, es posible montar el snapshot correspondiente y acceder al contenido utilizando las herramientas habituales.

## Instalación de Kopia

Dado que Kopia es una aplicación reciente, no está incluida en los repositorios oficiales de Ubuntu. Sin embargo, la instalación es sencilla. Puedes descargar el paquete .deb desde el repositorio oficial de Kopia y luego instalarlo en tu sistema utilizando el siguiente comando:

```bash
wget https://github.com/kopia/kopia/releases/download/v0.13.0/kopia_0.13.0_linux_amd64.deb -O /tmp/kopia.deb
dpkg -i /tmp/kopia.deb
```

## Configuración del repositorio

A continuación, veremos cómo configurar un repositorio utilizando Contabo Object Storage como ejemplo. Para ello, necesitarás:

1. Una cuenta en Contabo Object Storage
2. Un bucket con el nombre de tu host
3. Credenciales de acceso (access key, secret key y endpoint)

Una vez que tengas estos datos, ejecuta:

```bash
kopia repository create s3 --bucket=<nombre del bucket> \
    --access-key=<access key> \
    --secret-access-key=<secret key> \
    --endpoint=eu2.contabostorage.com
```

## Configuración de políticas de retención

Kopia permite ajustar las políticas de retención según tus necesidades:

```bash
kopia policy set --global --compression=zstd
kopia policy set --global --keep-annual 0
kopia policy set --global --keep-monthly 3
kopia policy set --global --keep-weekly 4
kopia policy set --global --keep-daily 7
kopia policy set --global --keep-latest 20
```

## Script de respaldo

Aquí tienes un ejemplo de script de respaldo completo:

```bash
#!/bin/bash

export KOPIA_PASSWORD="<contraseña>"

ACCESS_KEY="<access key>"
SECRET_KEY="<secret key>"
ENDPOINT="eu2.contabostorage.com"
BUCKET_NAME="<nombre del bucket>"

# Conectar al repositorio S3
kopia repository connect s3 \
    --bucket="$BUCKET_NAME" \
    --access-key="$ACCESS_KEY" \
    --secret-access-key="$SECRET_KEY" \
    --endpoint="$ENDPOINT"

# Crear snapshot
kopia snapshot create /home/*/web/*/public_html \
    --description "Websites $HOSTNAME"

# Ejecutar mantenimiento
kopia maintenance run --full

# Desconectar del repositorio
kopia repository disconnect
```

## Configuración del cron

Para automatizar los backups, añade el script al cron:

```bash
(crontab -l 2>/dev/null; echo "*/15 * * * * /etc/backup.sh") | crontab -
```

## Uso básico de Kopia

### Listado de snapshots

Para ver los snapshots almacenados:

```bash
kopia snapshot list
```

### Acceso a los snapshots

Para montar y acceder a un snapshot:

```bash
kopia mount <snapshot-ID> <directorio-de-montaje>
```

## Conclusiones

Kopia es una herramienta poderosa y eficiente para realizar copias de seguridad de manera segura. Con características como:

- Soporte para múltiples tipos de repositorio
- Políticas de retención flexibles
- Deduplicación y compresión
- Cifrado integrado
- Interfaz CLI y GUI

Kopia te brinda la confianza y tranquilidad de que tus datos estarán protegidos y disponibles para su recuperación en caso de cualquier eventualidad.

¿Ya utilizas alguna herramienta de backup? ¿Qué te parece Kopia en comparación? ¡Comparte tu experiencia en los comentarios!
