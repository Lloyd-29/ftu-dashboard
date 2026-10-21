<?php

namespace App\Support;

final class TemporaryPassword
{
    public static function generate(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        $max = strlen($alphabet) - 1;
        $result = '';
        for ($i = 0; $i < 12; $i++) {
            $result .= $alphabet[random_int(0, $max)];
        }
        return $result;
    }
}
