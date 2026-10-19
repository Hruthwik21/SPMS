# SPMS - Student Performance Management System

A full-stack web application for managing, tracking, and analyzing student academic performance across departments. Built with Flask, SQLAlchemy, and a modern vanilla JS frontend with Chart.js visualizations.

## Live Demo

**https://spms-kujp.onrender.com**

Login credentials:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| CSE Dept | `cs_dept` | `cs123` |
| ME Dept | `me_dept` | `me123` |
| EE Dept | `ee_dept` | `ee123` |

## Features

- **JWT Authentication** - Secure token-based auth with role-based access control
- **Department-level Access** - Admins see all data; department staff see only their students
- **Performance Analytics** - Real-time dashboards with pass rates, CGPA stats, and GPA trends
- **SGPA/CGPA Engine** - Automatic calculation based on configurable grade points
- **Course Management** - CRUD for courses, marks, and student details
- **Interactive Charts** - Doughnut, bar, and line charts for data visualization
- **Responsive Design** - Dark-themed UI built with modern CSS
- **RESTful API** - Clean API design with proper HTTP status codes
- **Docker Support** - One-command deployment with Docker

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Backend   | Flask 3.1, SQLAlchemy 3.1, Flask-Login        |
| Database  | PostgreSQL (Neon) / SQLite (development)      |
| Auth      | PyJWT, Werkzeug password hashing              |
| Frontend  | Vanilla JS, Chart.js 4.4, CSS3 (custom)       |
| Testing   | pytest                                        |
| CI/CD     | GitHub Actions                                |
| Deploy    | Docker, Gunicorn                              |

## Project Structure

```
SPMS/
├── app/
│   ├── __init__.py          # App factory & seed data
│   ├── config.py            # Environment-based config
│   ├── models.py            # SQLAlchemy models
│   ├── auth.py              # JWT & access control decorators
│   ├── routes/
│   │   ├── auth_routes.py   # Login, profile, password change
│   │   ├── student_routes.py
│   │   ├── course_routes.py
│   │   ├── mark_routes.py
│   │   ├── detail_routes.py
│   │   └── analytics_routes.py
│   ├── services/
│   │   └── gpa_calculator.py  # SGPA/CGPA computation engine
│   ├── templates/           # Jinja2 HTML templates
│   └── static/              # CSS & JS assets
├── tests/                   # pytest test suite
├── .github/workflows/ci.yml
├── Dockerfile
├── requirements.txt
├── pyproject.toml
└── run.py
```

## Getting Started

### Prerequisites

- Python 3.11+
- pip

### Local Setup

```bash
# Clone the repository
git clone https://github.com/Hruthwik21/SPMS.git
cd SPMS

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (defaults to SQLite for dev)

# Run the application
python run.py
```

The app will be available at `http://localhost:5000`

### Demo Credentials

| Role      | Username  | Password  | Access        |
|-----------|-----------|-----------|---------------|
| Admin     | admin     | admin123  | All departments |
| CSE Dept  | cs_dept   | cs123     | CSE students only |
| ME Dept   | me_dept   | me123     | ME students only |
| EE Dept   | ee_dept   | ee123     | EE students only |

### Running Tests

```bash
pip install pytest
pytest tests/ -v
```

### Docker Deployment

```bash
docker build -t spms .
docker run -p 5000:5000 -e DATABASE_URL=postgresql://... -e JWT_SECRET=... spms
```

## API Endpoints

| Method | Endpoint                   | Description              | Auth |
|--------|----------------------------|--------------------------|------|
| POST   | /api/login                 | Authenticate & get JWT   | No   |
| GET    | /api/profile               | Get current user profile | Yes  |
| POST   | /api/change-password       | Change own password      | Yes  |
| GET    | /api/students              | List students (filtered) | Yes  |
| POST   | /api/students              | Add new student          | Yes  |
| GET    | /api/students/:roll_no     | Get student details      | Yes  |
| PUT    | /api/students/:roll_no     | Update student           | Yes  |
| DELETE | /api/students/:roll_no     | Delete student           | Yes  |
| GET    | /api/courses               | List all courses         | Yes  |
| POST   | /api/courses               | Add/update course        | Admin|
| GET    | /api/marks                 | Get marks (filtered)     | Yes  |
| POST   | /api/marks                 | Add/update marks         | Yes  |
| GET    | /api/student_details       | Get grade details        | Yes  |
| POST   | /api/student_details       | Add/update grade detail  | Yes  |
| GET    | /api/sgpa_cgpa             | Get GPA report           | Yes  |
| GET    | /api/pass_stats            | Pass/fail statistics     | Yes  |
| GET    | /api/cgpa_stats            | CGPA stats by department | Yes  |
| GET    | /api/course_performance    | Course-level analytics   | Yes  |
| GET    | /api/dashboard_summary     | Dashboard overview data  | Yes  |

## License

MIT
