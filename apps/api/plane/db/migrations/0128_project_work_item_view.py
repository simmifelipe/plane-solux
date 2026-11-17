# Solar: toggle to show/hide the work items ("Tarefas") entry in the project menu

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0127_profile_default_language"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="work_item_view",
            field=models.BooleanField(default=True),
        ),
    ]
