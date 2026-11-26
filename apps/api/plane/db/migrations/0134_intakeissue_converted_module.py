# Solar: requests (intake issues) converted into a "Demanda" (module)

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('db', '0133_module_view'),
    ]

    operations = [
        migrations.AddField(
            model_name='intakeissue',
            name='converted_module',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='converted_intake_issues', to='db.module'),
        ),
    ]
