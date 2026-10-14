from app import db
from app.models import Course, StudentDetail, GradePoint


class GPACalculator:
    @staticmethod
    def _grade_point_map():
        return {gp.grade: gp.points for gp in GradePoint.query.all()}

    @classmethod
    def calculate_sgpa(cls, roll_no, semester):
        grade_points = cls._grade_point_map()
        details = StudentDetail.query.filter_by(roll_no=roll_no, semester=semester).all()

        if not details:
            return None

        total_credits = 0
        total_points = 0

        for detail in details:
            course = Course.query.filter_by(course_code=detail.course_code).first()
            if course and detail.grade in grade_points:
                total_credits += course.credits
                total_points += course.credits * grade_points[detail.grade]

        if total_credits == 0:
            return None

        return round(total_points / total_credits, 2)

    @classmethod
    def calculate_cgpa(cls, roll_no, up_to_semester=None):
        grade_points = cls._grade_point_map()

        if up_to_semester is not None:
            details = StudentDetail.query.filter(
                StudentDetail.roll_no == roll_no,
                StudentDetail.semester <= up_to_semester,
            ).all()
        else:
            details = StudentDetail.query.filter_by(roll_no=roll_no).all()

        if not details:
            return None

        total_credits = 0
        total_points = 0

        for detail in details:
            course = Course.query.filter_by(course_code=detail.course_code).first()
            if course and detail.grade in grade_points:
                total_credits += course.credits
                total_points += course.credits * grade_points[detail.grade]

        if total_credits == 0:
            return None

        return round(total_points / total_credits, 2)

    @classmethod
    def get_student_gpa_report(cls, roll_no):
        details = StudentDetail.query.filter_by(roll_no=roll_no).all()
        semesters = sorted(set(d.semester for d in details))

        report = []
        for sem in semesters:
            sgpa = cls.calculate_sgpa(roll_no, sem)
            cgpa = cls.calculate_cgpa(roll_no, sem)
            report.append({"roll_no": roll_no, "semester": sem, "sgpa": sgpa, "cgpa": cgpa})

        return report

    @classmethod
    def get_course_performance(cls, course_code):
        details = StudentDetail.query.filter_by(course_code=course_code).all()
        grade_points = cls._grade_point_map()

        if not details:
            return None

        total = len(details)
        passed = sum(1 for d in details if grade_points.get(d.grade, 0) > 0)
        grades_dist = {}
        for d in details:
            grades_dist[d.grade] = grades_dist.get(d.grade, 0) + 1

        avg_points = sum(grade_points.get(d.grade, 0) for d in details) / total

        return {
            "course_code": course_code,
            "total_students": total,
            "passed": passed,
            "failed": total - passed,
            "pass_percentage": round((passed / total) * 100, 2) if total > 0 else 0,
            "average_grade_points": round(avg_points, 2),
            "grade_distribution": grades_dist,
        }
