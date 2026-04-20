-- QuickGrade Database Schema
-- Run this once in Supabase Dashboard → SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  school        TEXT DEFAULT '',
  role          TEXT DEFAULT 'teacher',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE forums (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  subject            TEXT NOT NULL,
  class              TEXT NOT NULL,
  exam_date          DATE,
  total_marks        INT DEFAULT 100,
  status             TEXT DEFAULT 'active',
  question_paper_url TEXT,
  textbook_url       TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id     UUID REFERENCES forums(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  reg_number   TEXT NOT NULL,
  sheet_url    TEXT,
  ocr_text     TEXT,
  scores       JSONB DEFAULT '{}',
  total        INT DEFAULT 0,
  percentage   FLOAT DEFAULT 0,
  uploaded_by  UUID REFERENCES users(id),
  evaluated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE model_answers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id     UUID REFERENCES forums(id) ON DELETE CASCADE,
  question_num INT NOT NULL,
  answer_text  TEXT NOT NULL,
  keywords     TEXT[] DEFAULT '{}',
  marks        INT NOT NULL,
  note         TEXT DEFAULT ''
);

CREATE INDEX ON forums(teacher_id);
CREATE INDEX ON students(forum_id);
CREATE INDEX ON model_answers(forum_id);
