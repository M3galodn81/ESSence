CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`details` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'general',
	`author_id` text NOT NULL,
	`target_departments` text,
	`is_active` integer DEFAULT true,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
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
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`days` integer NOT NULL,
	`reason` text,
	`status` text DEFAULT 'pending',
	`approved_by` text,
	`approved_at` integer,
	`comments` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`period` integer DEFAULT 1 NOT NULL,
	`basic_salary` integer NOT NULL,
	`allowances` text,
	`deductions` text,
	`gross_pay` integer NOT NULL,
	`net_pay` integer NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text DEFAULT 'accident' NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`severity` text DEFAULT 'low',
	`status` text DEFAULT 'pending',
	`location` text NOT NULL,
	`date_occurred` integer NOT NULL,
	`time_occurred` text NOT NULL,
	`parties_involved` text,
	`witnesses` text,
	`action_taken` text,
	`details` text,
	`images` text,
	`assigned_to` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`shift_role` text,
	`is_all_day` integer DEFAULT false,
	`status` text DEFAULT 'scheduled',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`department` text,
	`position` text,
	`employee_id` text,
	`phone_number` text,
	`emergency_contact` text,
	`address` text,
	`hire_date` integer,
	`salary` integer,
	`manager_id` text,
	`is_active` integer DEFAULT true,
	`profile_picture` text,
	`annual_leave_balance` integer DEFAULT 15,
	`sick_leave_balance` integer DEFAULT 10,
	`emergency_leave_balance` integer DEFAULT 5,
	`annual_leave_balance_limit` integer DEFAULT 15,
	`sick_leave_balance_limit` integer DEFAULT 10,
	`emergency_leave_balance_limit` integer DEFAULT 5,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_employee_id_unique` ON `users` (`employee_id`);