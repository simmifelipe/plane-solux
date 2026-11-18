# Solar: labels on modules ("Demandas")

import django.contrib.postgres.fields
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0129_module_priority"),
    ]

    operations = [
        migrations.AddField(
            model_name="module",
            name="label_ids",
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.UUIDField(), blank=True, default=list, size=None
            ),
        ),
    ]
