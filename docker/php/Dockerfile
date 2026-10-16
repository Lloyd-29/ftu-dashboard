FROM php:8.4-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        libzip-dev \
        libonig-dev \
    && docker-php-ext-install \
        pdo_mysql \
        mbstring \
        zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

COPY docker/php/entrypoint.sh /usr/local/bin/ftu-entrypoint.sh

RUN chmod +x /usr/local/bin/ftu-entrypoint.sh

ENV COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /var/www/html

ENTRYPOINT ["/usr/local/bin/ftu-entrypoint.sh"]

CMD ["php-fpm"]