CREATE TABLE `labor_cost_data` (
	`id` text PRIMARY KEY NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`total_sales` integer NOT NULL,
	`total_labor_cost` integer NOT NULL,
	`labor_cost_percentage` integer NOT NULL,
	`status` text,
	`performance_rating` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text DEFAULT 'low',
	`status` text DEFAULT 'pending',
	`location` text,
	`item_name` text,
	`item_quantity` integer,
	`estimated_cost` integer,
	`assigned_to` text,
	`resolved_by` text,
	`resolved_at` integer,
	`notes` text,
	`attachments` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `schedules` ADD `shift_role` text;--> statement-breakpoint
ALTER TABLE `users` ADD `annual_leave_balance` integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE `users` ADD `sick_leave_balance` integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE `users` ADD `emergency_leave_balance` integer DEFAULT 5;