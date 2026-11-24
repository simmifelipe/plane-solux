# Solar: saved views of modules ("Visualizações de Demandas")

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('db', '0132_module_comment_reactions'),
    ]

    operations = [
        migrations.CreateModel(
            name='ModuleView',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Last Modified At')),
                ('deleted_at', models.DateTimeField(blank=True, null=True, verbose_name='Deleted At')),
                ('id', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ('name', models.CharField(max_length=255, verbose_name='View Name')),
                ('description', models.TextField(blank=True, verbose_name='View Description')),
                ('filters', models.JSONField(default=dict)),
                ('display_filters', models.JSONField(default=dict)),
                ('access', models.PositiveSmallIntegerField(choices=[(0, 'Private'), (1, 'Public')], default=1)),
                ('sort_order', models.FloatField(default=65535)),
                ('logo_props', models.JSONField(default=dict)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created_by', to=settings.AUTH_USER_MODEL, verbose_name='Created By')),
                ('owned_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='module_views', to=settings.AUTH_USER_MODEL)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_%(class)s', to='db.project')),
                ('updated_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated_by', to=settings.AUTH_USER_MODEL, verbose_name='Last Modified By')),
                ('workspace', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workspace_%(class)s', to='db.workspace')),
            ],
            options={
                'verbose_name': 'Module View',
                'verbose_name_plural': 'Module Views',
                'db_table': 'module_views',
                'ordering': ('-created_at',),
            },
        ),
    ]
