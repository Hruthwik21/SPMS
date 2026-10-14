from app.services.gpa_calculator import GPACalculator


def _grade_point_map():
    from app.models import GradePoint

    return {gp.grade: gp.points for gp in GradePoint.query.all()}


def calculate_sgpa(roll_no, semester):
    return GPACalculator.calculate_sgpa(roll_no, semester)


def calculate_cgpa(roll_no, semester):
    return GPACalculator.calculate_cgpa(roll_no, semester)
