# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path


from plane.app.views import (
    ModuleViewSet,
    ModuleViewViewSet,
    ModuleIssueViewSet,
    ModuleLinkViewSet,
    ModuleCommentViewSet,
    ModuleCommentReactionViewSet,
    ModuleFavoriteViewSet,
    ModuleUserPropertiesEndpoint,
    ModuleArchiveUnarchiveEndpoint,
    ModuleAccessEndpoint,
    ModuleMyAccessEndpoint,
)


urlpatterns = [
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/module-views/",
        ModuleViewViewSet.as_view({"get": "list", "post": "create"}),
        name="project-module-views",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/module-views/<uuid:pk>/",
        ModuleViewViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-module-view-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/",
        ModuleViewSet.as_view({"get": "list", "post": "create"}),
        name="project-modules",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:pk>/",
        ModuleViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="project-modules",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/modules/",
        ModuleIssueViewSet.as_view({"post": "create_issue_modules"}),
        name="issue-module",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/issues/",
        ModuleIssueViewSet.as_view({"post": "create_module_issues", "get": "list"}),
        name="project-module-issues",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/issues/<uuid:issue_id>/",
        ModuleIssueViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="project-module-issues",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/module-links/",
        ModuleLinkViewSet.as_view({"get": "list", "post": "create"}),
        name="project-issue-module-links",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/module-links/<uuid:pk>/",
        ModuleLinkViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="project-issue-module-links",
    ),
    # Solar: comments on a "Demanda" (module)
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/comments/",
        ModuleCommentViewSet.as_view({"get": "list", "post": "create"}),
        name="project-module-comments",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/comments/<uuid:pk>/",
        ModuleCommentViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="project-module-comments",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/comments/<uuid:module_comment_id>/reactions/",
        ModuleCommentReactionViewSet.as_view({"post": "create"}),
        name="project-module-comment-reactions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/comments/<uuid:module_comment_id>/reactions/<str:reaction_code>/",
        ModuleCommentReactionViewSet.as_view({"delete": "destroy"}),
        name="project-module-comment-reactions",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-modules/",
        ModuleFavoriteViewSet.as_view({"get": "list", "post": "create"}),
        name="user-favorite-module",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/user-favorite-modules/<uuid:module_id>/",
        ModuleFavoriteViewSet.as_view({"delete": "destroy"}),
        name="user-favorite-module",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/user-properties/",
        ModuleUserPropertiesEndpoint.as_view(),
        name="cycle-user-filters",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/archive/",
        ModuleArchiveUnarchiveEndpoint.as_view(),
        name="module-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/archived-modules/",
        ModuleArchiveUnarchiveEndpoint.as_view(),
        name="module-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/archived-modules/<uuid:pk>/",
        ModuleArchiveUnarchiveEndpoint.as_view(),
        name="module-archive-unarchive",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/access/",
        ModuleAccessEndpoint.as_view(),
        name="module-access",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/access/<uuid:user_id>/",
        ModuleAccessEndpoint.as_view(),
        name="module-access-user",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/modules/<uuid:module_id>/my-access/",
        ModuleMyAccessEndpoint.as_view(),
        name="module-my-access",
    ),
]
