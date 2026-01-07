# backend/server/urls.py
from __future__ import annotations

from django.contrib import admin
from django.urls import path, include

from server.health import health 

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    # apps
    path("api/core/", include("core.urls")),
    path("api/jobs/", include("jobs.urls")),
]