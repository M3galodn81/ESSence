ALTER TABLE `users` ADD `annual_leave_balance_limit` integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE `users` ADD `sick_leave_balance_limit` integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE `users` ADD `emergency_leave_balance_limit` integer DEFAULT 5;