from django.contrib import admin
from django.urls import path, include
from core import views as core_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", core_views.health, name="api_health"),
    path("api/core/health/", core_views.health, name="core_health"),
    path("api/core/welcome/", core_views.welcome, name="core_welcome"),
    path("api/jobs/", include("jobs.urls")),
]