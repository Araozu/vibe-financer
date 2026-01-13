ALTER TABLE `transaction` ADD `target_account_id` text REFERENCES account(id) ON DELETE cascade;
