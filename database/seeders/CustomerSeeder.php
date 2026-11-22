<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        //

        Customer::create([
            'name' => 'Jokowi',
            'email' => 'jokowi@gmail.com',
        ]);

        Customer::create([
            'name' => 'Prabowo',
            'email' => 'prabowo@gmail.com',
        ]);

        Customer::create([
            'name' => 'Gibran',
            'email' => 'gibran@gmail.com',
        ]);
    }
}
