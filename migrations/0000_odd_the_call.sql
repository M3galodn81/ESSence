CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`category` text DEFAULT 'system',
	`entity_type` text,
	`entity_id` text,
	`details` text,
	`metadata` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activities` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_date_idx` ON `activities` (`created_at`);--> statement-breakpoint
CREATE TABLE `announcement_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `announcement_reads_announcement_id_user_id_unique` ON `announcement_reads` (`announcement_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`type` text DEFAULT 'general',
	`priority` text DEFAULT 'normal',
	`author_id` text NOT NULL,
	`target_departments` text,
	`target_roles` text,
	`is_active` integer DEFAULT true,
	`expires_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`time_in` integer NOT NULL,
	`time_out` integer,
	`clock_in_device` text,
	`clock_out_device` text,
	`status` text DEFAULT 'clocked_in',
	`is_late` integer DEFAULT false,
	`late_minutes` integer DEFAULT 0,
	`is_undertime` integer DEFAULT false,
	`undertime_minutes` integer DEFAULT 0,
	`overtime_minutes` integer DEFAULT 0,
	`total_break_minutes` integer DEFAULT 0,
	`total_work_minutes` integer,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `att_user_idx` ON `attendance` (`user_id`);--> statement-breakpoint
CREATE INDEX `att_date_idx` ON `attendance` (`date`);--> statement-breakpoint
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
	FOREIGN KEY (`attendance_id`) REFERENCES `attendance`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `break_att_idx` ON `breaks` (`attendance_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`is_paid` integer DEFAULT true,
	`pay_rate_multiplier` integer DEFAULT 100,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `holiday_date_idx` ON `holidays` (`date`);--> statement-breakpoint
CREATE TABLE `labor_cost_data` (
	`id` text PRIMARY KEY NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`total_sales` integer NOT NULL,
	`total_labor_cost` integer NOT NULL,
	`labor_cost_percentage` integer NOT NULL,
	`target_sales` integer,
	`budgeted_labor_cost` integer,
	`status` text,
	`performance_rating` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `labor_cost_data_month_year_unique` ON `labor_cost_data` (`month`,`year`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`day_type` text DEFAULT 'whole',
	`days` integer NOT NULL,
	`reason` text,
	`attachment_url` text,
	`status` text DEFAULT 'pending',
	`rejection_reason` text,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `user_request_idx` ON `leave_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`period` integer DEFAULT 1 NOT NULL,
	`basic_salary` integer NOT NULL,
	`overtime_pay` integer DEFAULT 0,
	`holiday_pay` integer DEFAULT 0,
	`night_diff_pay` integer DEFAULT 0,
	`allowances` text,
	`sss_contribution` integer DEFAULT 0,
	`philhealth_contribution` integer DEFAULT 0,
	`pagibig_contribution` integer DEFAULT 0,
	`withholding_tax` integer DEFAULT 0,
	`other_deductions` text,
	`gross_pay` integer NOT NULL,
	`total_deductions` integer NOT NULL,
	`net_pay` integer NOT NULL,
	`payment_status` text DEFAULT 'draft',
	`payment_date` integer,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_payslip_idx` ON `payslips` (`user_id`);--> statement-breakpoint
CREATE INDEX `period_idx` ON `payslips` (`user_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
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
	`nte_required` integer DEFAULT false,
	`nte_content` text,
	`assigned_to` text,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `report_user_idx` ON `reports` (`user_id`);--> statement-breakpoint
CREATE INDEX `report_status_idx` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` integer NOT NULL,
	`start_time` integer NOT NULL,
	`end_time` integer NOT NULL,
	`shift_type` text,
	`shift_role` text,
	`location` text,
	`is_remote` integer DEFAULT false,
	`grace_period_minutes` integer DEFAULT 15,
	`break_duration_minutes` integer DEFAULT 60,
	`status` text DEFAULT 'published',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_schedule_idx` ON `schedules` (`user_id`);--> statement-breakpoint
CREATE INDEX `schedule_date_idx` ON `schedules` (`date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'employee' NOT NULL,
	`is_active` integer DEFAULT true,
	`profile_picture` text,
	`first_name` text NOT NULL,
	`middle_name` text,
	`last_name` text NOT NULL,
	`birth_date` integer,
	`gender` text,
	`civil_status` text,
	`nationality` text,
	`phone_number` text,
	`address` text,
	`emergency_contact` text,
	`employee_id` text,
	`department` text,
	`position` text,
	`employment_status` text DEFAULT 'regular',
	`hire_date` integer,
	`inactive_date` integer,
	`salary` integer,
	`manager_id` text,
	`annual_leave_balance` integer DEFAULT 15,
	`sick_leave_balance` integer DEFAULT 10,
	`service_incentive_leave_balance` integer DEFAULT 5,
	`bereavement_leave_balance` integer DEFAULT 3,
	`maternity_leave_balance` integer DEFAULT 105,
	`paternity_leave_balance` integer DEFAULT 7,
	`solo_parent_leave_balance` integer DEFAULT 7,
	`magna_carta_leave_balance` integer DEFAULT 60,
	`vawc_leave_balance` integer DEFAULT 10,
	`annual_leave_balance_limit` integer DEFAULT 15,
	`sick_leave_balance_limit` integer DEFAULT 10,
	`service_incentive_leave_balance_limit` integer DEFAULT 5,
	`bereavement_leave_balance_limit` integer DEFAULT 3,
	`maternity_leave_balance_limit` integer DEFAULT 105,
	`paternity_leave_balance_limit` integer DEFAULT 7,
	`solo_parent_leave_balance_limit` integer DEFAULT 7,
	`magna_carta_leave_balance_limit` integer DEFAULT 60,
	`vawc_leave_balance_limit` integer DEFAULT 10,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_employee_id_unique` ON `users` (`employee_id`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `dept_idx` ON `users` (`department`);--> statement-breakpoint
CREATE INDEX `manager_idx` ON `users` (`manager_id`);--> statement-breakpoint
CREATE INDEX `lastname_idx` ON `users` (`last_name`);