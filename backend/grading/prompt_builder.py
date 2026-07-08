from __future__ import annotations
from typing import List, Dict
from config.settings import GRADING
from utils.text import trim_to_budget

SYSTEM_MESSAGE = (
    "You are a supportive and encouraging academic mentor. Your goal is to help students "
    "grow by recognizing their efforts while gently pointing out where they can improve. "
    "Be very generous with marks, rewarding partial understanding with high scores. "
    "In the 'feedback' section, use a kind, helpful tone. Start with what they got right "
    "before suggesting improvements. Respond ONLY with valid JSON."
)

def build_prompt(
    question:          str,
    student_answer:    str,
    reference_context: str,
    max_marks:         int,
    quality_label:     str = "ok",
) -> str:
    context_body = trim_to_budget(reference_context, GRADING.max_context_chars)
    answer_body  = trim_to_budget(student_answer,    GRADING.max_answer_chars)
    
    return f"""Grade the following student answer based on the provided reference answer.

QUESTION:
{question}

REFERENCE ANSWER/GUIDELINES:
{context_body}

STUDENT ANSWER:
{answer_body}

MAX MARKS: {max_marks}

LENIENCY RULE: Be extremely liberal and generous with MARKS. Award 70-80% of marks for even partial understanding. Give FULL MARKS whenever possible if the core concept is present. In the 'feedback' section, be GENTLE and SUPPORTIVE—start with a positive note and provide kind advice on how to reach the next level.

Provide your evaluation in the following JSON format:
{{
  "marks_awarded": number,
  "grading_confidence": number (0.0 to 1.0),
  "key_points": ["point 1", "point 2"],
  "points_covered": ["point 1"],
  "points_partially_covered": [],
  "points_missing": ["point 2"],
  "marks_breakdown": "Explanation of how marks were distributed",
  "evaluation": "Brief summary of the performance",
  "feedback": "Constructive advice for the student"
}}"""

def build_batch_prompt(
    questions_data: List[Dict],
) -> str:
    items_str = ""
    for i, q in enumerate(questions_data):
        q_text = q["question"]
        ans_text = trim_to_budget(q["student_answer"], 1000)
        ctx_text = trim_to_budget(q["reference_context"], 1500)
        max_m = q["max_marks"]
        
        items_str += f"""
--- ITEM {i+1} ---
QUESTION: {q_text}
REFERENCE: {ctx_text}
STUDENT ANSWER: {ans_text}
MAX MARKS: {max_m}
"""

    return f"""Grade the following {len(questions_data)} student answers. 
Provide a JSON array of objects, one for each item in the exact order presented.

ITEMS TO GRADE:
{items_str}

LENIENCY RULE: Be extremely liberal with scoring.NEVER GIVE ZERO MARKS.FOR EVERY QUESTION AWARD 50% MARKS IF ATTEMPTED. Aim to award minimum 70-80% marks for all answers that show effort, and give FULL MARKS when possible. Be GENTLE, supportive, and helpful in the 'feedback' section for each object. Help the student feel confident while showing them the path to improve.

Each object in the array must follow this schema:
{{
  "marks_awarded": number,
  "grading_confidence": number,
  "key_points": [string],
  "points_covered": [string],
  "points_partially_covered": [string],
  "points_missing": [string],
  "marks_breakdown": string,
  "evaluation": string,
  "feedback": string
}}

Return ONLY the JSON array."""