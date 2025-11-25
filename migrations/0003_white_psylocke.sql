CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`time_in` integer NOT NULL,
	`time_out` integer,
	`status` text DEFAULT 'clocked_in',
	`total_break_minutes` integer DEFAULT 0,
	`total_work_minutes` integer,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `breaks` (
	`id` text PRIMARY KEY NOT NULL,
	`attendance_id` text NOT NULL,
	`user_id` text NOT NULL,
	`break_start` integer NOT NULL,
	`break_end` integer,
	`break_minutes` integer,
	`break_type` text DEFAULT 'regular',
	`notes` text,
	`created_at` integer,
	FOREIGN KEY (`attendance_id`) REFERENCES `attendance`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
