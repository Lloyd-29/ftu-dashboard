<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Facades\DB;

final class DocumentTypes
{
    public const DEFAULTS = [
        'Residual Life Assessment', 'RBI', 'Stress Analysis',
        'Laporan Inspeksi', 'Dokumen Vendor', 'Lainnya',
    ];

    public static function all(): array
    {
        $value = Setting::query()->where('key', 'document_types')->value('value');
        if ($value === null) return self::DEFAULTS;
        $parsed = json_decode($value, true);
        return is_array($parsed) && count($parsed) > 0
            && array_is_list($parsed) && count(array_filter($parsed, 'is_string')) === count($parsed)
            ? $parsed : self::DEFAULTS;
    }

    public static function save(array $types): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => 'document_types'],
            ['value' => json_encode($types, JSON_UNESCAPED_UNICODE), 'updated_at' => now(), 'created_at' => now()],
        );
    }
}
