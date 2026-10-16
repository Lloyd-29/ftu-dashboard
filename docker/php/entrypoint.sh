#!/bin/sh
set -eu

cd /var/www/html

if [ -f artisan ]; then
    mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache

    chown -R www-data:www-data storage bootstrap/cache
    chmod -R u+rwX storage bootstrap/cache
fi

exec docker-php-entrypoint "$@"