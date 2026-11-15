# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Profile, User
from plane.db.models.user import get_default_language


@pytest.mark.unit
class TestDefaultLanguage:
    def test_falls_back_to_english(self, monkeypatch):
        monkeypatch.delenv("DEFAULT_USER_LANGUAGE", raising=False)
        assert get_default_language() == "en"

    def test_empty_value_falls_back_to_english(self, monkeypatch):
        monkeypatch.setenv("DEFAULT_USER_LANGUAGE", "")
        assert get_default_language() == "en"

    @pytest.mark.django_db
    def test_new_profiles_use_the_configured_language(self, monkeypatch):
        monkeypatch.setenv("DEFAULT_USER_LANGUAGE", "pt-BR")
        user = User.objects.create(email="lang@plane.so", username="lang_user")
        assert Profile.objects.create(user=user).language == "pt-BR"
