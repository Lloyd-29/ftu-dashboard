# FTU M4 demo backend image: immutable source, no host bind mounts.
FROM php:8.4-fpm-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libzip-dev libonig-dev libicu-dev libsqlite3-dev \
    && docker-php-ext-install pdo_mysql pdo_sqlite mbstring zip intl \
    && rm -rf /var/lib/apt/lists/*
RUN printf 'upload_max_filesize=16M\npost_max_size=17M\n' > /usr/local/etc/php/conf.d/ftu-uploads.ini
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/html
COPY backend/composer.json backend/composer.lock ./
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --optimize-autoloader
COPY backend/ ./
RUN composer dump-autoload --no-dev --no-interaction --optimize --no-scripts \
    && php artisan package:discover --ansi \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
COPY docker/php/entrypoint.sh /usr/local/bin/ftu-entrypoint.sh
RUN chmod +x /usr/local/bin/ftu-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/ftu-entrypoint.sh"]
CMD ["php-fpm"]
