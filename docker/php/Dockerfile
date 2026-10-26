FROM php:8.4-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libzip-dev \
        libonig-dev \
        libicu-dev \
        libsqlite3-dev \
    && docker-php-ext-install \
        pdo_mysql \
        pdo_sqlite \
        mbstring \
        zip \
        intl \
    && rm -rf /var/lib/apt/lists/*

# Permit 15 MB PDFs plus multipart overhead; app validates exact file size.
RUN printf 'upload_max_filesize=16M\npost_max_size=17M\n' > /usr/local/etc/php/conf.d/ftu-uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/php/entrypoint.sh /usr/local/bin/ftu-entrypoint.sh
RUN chmod +x /usr/local/bin/ftu-entrypoint.sh
ENV COMPOSER_ALLOW_SUPERUSER=1
WORKDIR /var/www/html
ENTRYPOINT ["/usr/local/bin/ftu-entrypoint.sh"]
CMD ["php-fpm"]
