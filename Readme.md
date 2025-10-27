# Employee Management System

## Overview

This is a comprehensive employee management system built as a full-stack web application. The system provides functionalities for HR management, employee self-service, leave tracking, payroll, scheduling, training, and document management. It features a modern React frontend with a Node.js/Express backend and SQLite database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state and caching
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation
- **Authentication**: Context-based auth provider with protected routes

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Management**: Express sessions with SQLite session store
- **Password Security**: Built-in crypto module with scrypt hashing
- **API Design**: RESTful endpoints with structured error handling
- **Middleware**: Custom logging, JSON parsing, and authentication middleware

### Database Layer
- **Database**: SQLite with better-sqlite3 driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Validation**: Drizzle-Zod for runtime schema validation
- **Session Storage**: SQLite-based session store for persistent sessions

### Core Data Models
- **Users**: Employee profiles with roles (employee, manager, hr), departments, and hierarchical relationships
- **Leave Requests**: Leave management with approval workflows
- **Payslips**: Salary statements with detailed breakdowns
- **Schedules**: Employee work schedules and shift management
- **Training**: Training programs with user progress tracking
- **Documents**: Document storage and management
- **Announcements**: Company-wide and targeted communications
- **Activities**: System activity logging and audit trails

### Authentication & Authorization
- **Session-based Authentication**: Secure session management with SQLite storage
- **Role-based Access Control**: Three-tier role system (employee, manager, hr)
- **Protected Routes**: Client-side route protection with authentication checks
- **Password Security**: Salted hash storage using scrypt algorithm

### Development & Build System
- **Development Server**: Vite dev server with HMR and TypeScript support
- **Build Process**: Separate frontend (Vite) and backend (esbuild) builds
- **Development Tools**: TypeScript, tsx for development execution
- **Path Aliases**: Configured aliases for clean import statements

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight client-side routing
- **react-hook-form**: Form handling and validation
- **@hookform/resolvers**: Form validation resolvers

### UI Component Libraries
- **@radix-ui/***: Comprehensive set of accessible UI primitives
- **class-variance-authority**: Utility for creating component variants
- **clsx**: Conditional className utility
- **tailwindcss**: Utility-first CSS framework

### Database & Backend
- **better-sqlite3**: SQLite database driver for Node.js
- **drizzle-orm**: Type-safe ORM for SQLite
- **drizzle-kit**: Database toolkit for migrations and introspection
- **passport**: Authentication middleware
- **passport-local**: Local username/password authentication strategy
- **express-session**: Session middleware for Express

### Development Tools
- **vite**: Fast build tool and dev server
- **typescript**: Type safety and enhanced developer experience
- **esbuild**: Fast JavaScript bundler for production builds
- **tsx**: TypeScript execution environment for development

### Additional Utilities
- **date-fns**: Date manipulation and formatting
- **zod**: Runtime type validation and schema definition
- **cmdk**: Command palette component
- **embla-carousel-react**: Carousel component for UI