-- ============================================================================
-- Pronexus SaaS Platform - PostgreSQL Database Schema
-- Hub and Spoke Architecture for Construction Industry
-- ============================================================================

-- ============================================================================
-- 1. CREATE ENUMS
-- ============================================================================

-- User role enumeration
CREATE TYPE user_role AS ENUM (
    'Admin',
    'Contractor',
    'Sub-contractor'
);

-- Document status enumeration
CREATE TYPE document_status AS ENUM (
    'Pending',
    'Verified',
    'Rejected'
);

-- ============================================================================
-- 2. USERS TABLE
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT email_lowercase CHECK (email = LOWER(email)),
    CONSTRAINT company_name_not_empty CHECK (company_name <> '')
);

-- Index for efficient email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- 3. BUILD_SITES TABLE
-- ============================================================================

CREATE TABLE build_sites (
    id VARCHAR(50) PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    total_budget DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT total_budget_positive CHECK (total_budget > 0),
    CONSTRAINT site_name_not_empty CHECK (site_name <> ''),
    CONSTRAINT location_not_empty CHECK (location <> '')
);

-- Index for efficient site lookups
CREATE INDEX idx_build_sites_site_name ON build_sites(site_name);

-- ============================================================================
-- 4. SITE_ASSIGNMENTS TABLE (Hub and Spoke Junction Table)
-- ============================================================================

CREATE TABLE site_assignments (
    user_id UUID NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite Primary Key
    PRIMARY KEY (user_id, site_id),
    
    -- Foreign Key Constraints
    CONSTRAINT fk_site_assignments_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_site_assignments_site_id 
        FOREIGN KEY (site_id) 
        REFERENCES build_sites(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX idx_site_assignments_user_id ON site_assignments(user_id);
CREATE INDEX idx_site_assignments_site_id ON site_assignments(site_id);

-- ============================================================================
-- 5. DOCUMENTS TABLE (For Invoice/Pro-forma Uploads)
-- ============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id VARCHAR(50) NOT NULL,
    uploaded_by UUID NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    status document_status DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraints
    CONSTRAINT fk_documents_site_id 
        FOREIGN KEY (site_id) 
        REFERENCES build_sites(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_documents_uploaded_by 
        FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    
    -- Constraints
    CONSTRAINT file_url_not_empty CHECK (file_url <> '')
);

-- Indexes for efficient queries
CREATE INDEX idx_documents_site_id ON documents(site_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- ============================================================================
-- 6. ROW-LEVEL SECURITY POLICIES (Optional but Recommended)
-- ============================================================================
-- Uncomment the following if you want to enable PostgreSQL Row-Level Security
-- This adds an extra layer of isolation at the database level

/*
-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see documents for sites they are assigned to
CREATE POLICY user_can_view_documents ON documents FOR SELECT
    USING (
        uploaded_by = CURRENT_USER_ID
        OR site_id IN (
            SELECT site_id FROM site_assignments 
            WHERE user_id = CURRENT_USER_ID
        )
    );

-- Policy: Users can only upload documents to sites they are assigned to
CREATE POLICY user_can_insert_documents ON documents FOR INSERT
    WITH CHECK (
        uploaded_by = CURRENT_USER_ID
        AND site_id IN (
            SELECT site_id FROM site_assignments 
            WHERE user_id = CURRENT_USER_ID
        )
    );
*/

-- ============================================================================
-- 7. UPDATE TRIGGER FOR updated_at TIMESTAMPS
-- ============================================================================

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to build_sites table
CREATE TRIGGER trigger_build_sites_updated_at
BEFORE UPDATE ON build_sites
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to documents table
CREATE TRIGGER trigger_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- INSERT INTO users (company_name, email, password_hash, role) VALUES
-- ('Acme Construction', 'contractor@acme.com', 'hashed_password_1', 'Contractor'),
-- ('BuildRight Services', 'subcontractor@buildright.com', 'hashed_password_2', 'Sub-contractor'),
-- ('Admin User', 'admin@pronexus.com', 'hashed_password_3', 'Admin');

-- INSERT INTO build_sites (id, site_name, location, total_budget) VALUES
-- ('SITE-8492-LDN', 'Downtown Plaza', 'London, UK', 500000.00),
-- ('SITE-1205-NYC', 'Midtown Complex', 'New York, USA', 750000.00);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
