# Solar: priority on modules ("Demandas")

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0128_project_work_item_view"),
    ]

    operations = [
        migrations.AddField(
            model_name="module",
            name="priority",
            field=models.CharField(
                choices=[
                    ("urgent", "Urgent"),
                    ("high", "High"),
                    ("medium", "Medium"),
                    ("low", "Low"),
                    ("none", "None"),
                ],
                default="none",
                max_length=30,
            ),
        ),
    ]
