from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health, name="core_health"),
    path("welcome/", views.welcome, name="core_welcome"),
]