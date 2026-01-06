# backend/jobs/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("start/", views.start_job, name="jobs_start"),
    path("cancel/<str:job_id>/", views.cancel_job, name="jobs_cancel"),
    path("stream/<str:job_id>/", views.stream_job, name="jobs_stream"),
    # path("status/<str:job_id>/", views.status_job, name="jobs_status"),
]